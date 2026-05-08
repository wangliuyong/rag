import { v4 as uuidv4 } from "uuid";
import { getDb } from "../store/db.js";
import { parseDocument } from "./parser.js";
import { splitText } from "./chunker.js";
import { embedTexts } from "./embeddings.js";
import {
  deleteByDocumentId,
  ensureCollection,
  upsertChunks,
} from "./vectorStore.js";
import { getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

const processing = new Set<string>();

export function scheduleIngest(documentId: string): void {
  void ingestDocument(documentId).catch((err) => {
    logger.error({ documentId, err }, "索引任务失败");
  });
}

export async function ingestDocument(documentId: string): Promise<void> {
  if (processing.has(documentId)) return;
  processing.add(documentId);
  const database = getDb();
  const env = getEnv();

  try {
    const row = database
      .prepare(
        `SELECT id, original_name, mime, file_path, status FROM documents WHERE id = ?`
      )
      .get(documentId) as
      | {
          id: string;
          original_name: string;
          mime: string;
          file_path: string;
          status: string;
        }
      | undefined;

    if (!row) {
      logger.warn({ documentId }, "文档不存在，跳过索引");
      return;
    }

    database
      .prepare(
        `UPDATE documents SET status = 'indexing', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
      )
      .run(documentId);

    const parsed = await parseDocument(row.file_path, row.mime);
    const chunks = await splitText(parsed.text);
    if (chunks.length === 0) {
      database
        .prepare(
          `UPDATE documents SET status = 'failed', chunk_count = 0, error_message = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .run("文档无有效文本内容", documentId);
      return;
    }

    await ensureCollection(env.EMBEDDING_DIMENSIONS);
    await deleteByDocumentId(documentId);

    const vectors = await embedTexts(chunks);
    const points = chunks.map((text, chunkIndex) => ({
      id: uuidv4(),
      vector: vectors[chunkIndex]!,
      payload: {
        documentId,
        filename: row.original_name,
        chunkIndex,
        text,
      },
    }));

    const batch = 64;
    for (let i = 0; i < points.length; i += batch) {
      await upsertChunks(points.slice(i, i + batch));
    }

    database
      .prepare(
        `UPDATE documents SET status = 'ready', chunk_count = ?, error_message = NULL, updated_at = datetime('now') WHERE id = ?`
      )
      .run(chunks.length, documentId);

    logger.info({ documentId, chunks: chunks.length }, "索引完成");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    database
      .prepare(
        `UPDATE documents SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(message, documentId);
    logger.error({ documentId, err: message }, "索引失败");
    throw e;
  } finally {
    processing.delete(documentId);
  }
}
