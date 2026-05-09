/** 索引管线：解析 → 切分 → 向量化 → 写入 Qdrant，并维护 documents 表状态 */
import { v4 as uuidv4 } from "uuid"; // 每个向量点的唯一 id
import { getDb } from "../store/db"; // 更新 documents 行状态
import { parseDocument } from "./parser"; // PDF/DOCX 转文本
import { splitText } from "./chunker"; // 长文本切块
import { embedTexts } from "./embeddings"; // 批量 embedding
import {
  deleteByDocumentId,
  ensureCollection,
  upsertChunks,
} from "./vectorStore"; // Qdrant 操作
import { getEnv } from "../config/env"; // 向量维度
import { logger } from "../utils/logger"; // 索引过程日志

/** 内存中去重：同一 documentId 并发/重复调度时只跑一个 ingest */
const processing = new Set<string>();

/**
 * 将索引任务丢入微任务队列：不阻塞调用方 HTTP 响应。
 * @param documentId 待索引的 documents.id
 */
export function scheduleIngest(documentId: string): void {
  void ingestDocument(documentId).catch((err) => {
    // 吞掉 Promise 拒绝，避免未处理 rejection；错误已在 ingestDocument 内写库
    logger.error({ documentId, err }, "索引任务失败");
  });
}

/**
 * 完整执行单文档索引：状态机 pending → indexing → ready/failed。
 * @param documentId 文档主键
 */
export async function ingestDocument(documentId: string): Promise<void> {
  if (processing.has(documentId)) return; // 已在跑则直接返回，防重入
  processing.add(documentId); // 占位锁
  const database = getDb(); // SQLite
  const env = getEnv(); // 需 EMBEDDING_DIMENSIONS

  try {
    const row = database
      .prepare(
        // 取解析所需字段；status 字段当前未分支使用但可扩展
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
      logger.warn({ documentId }, "文档不存在，跳过索引"); // 行被删则安静退出
      return;
    }

    database
      .prepare(
        // 标记进入索引中，清空历史错误
        `UPDATE documents SET status = 'indexing', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
      )
      .run(documentId);

    const parsed = await parseDocument(row.file_path, row.mime); // 磁盘 → 文本
    const chunks = await splitText(parsed.text); // 文本 → 块数组
    if (chunks.length === 0) {
      database
        .prepare(
          // 无可索引内容：标记失败并说明原因
          `UPDATE documents SET status = 'failed', chunk_count = 0, error_message = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .run("文档无有效文本内容", documentId);
      return; // 不再访问向量库
    }

    await ensureCollection(env.EMBEDDING_DIMENSIONS); // 确保集合存在
    await deleteByDocumentId(documentId); // 先删旧点，避免重复 id 或脏数据

    const vectors = await embedTexts(chunks); // 与 chunks 等长的向量列表
    const points = chunks.map((text, chunkIndex) => ({
      id: uuidv4(), // 每片段一个向量点 id
      vector: vectors[chunkIndex]!, // 非空断言：embedTexts 与 chunks 对齐
      payload: {
        documentId, // 回指业务文档
        filename: row.original_name, // 展示名
        chunkIndex, // 片段序号
        text, // 片段正文用于检索展示与上下文
      },
    }));

    const batch = 64; // 控制单次 upsert 体量，避免单次请求过大
    for (let i = 0; i < points.length; i += batch) {
      await upsertChunks(points.slice(i, i + batch)); // 分片写入 Qdrant
    }

    database
      .prepare(
        // 成功：记录片段数并置 ready
        `UPDATE documents SET status = 'ready', chunk_count = ?, error_message = NULL, updated_at = datetime('now') WHERE id = ?`
      )
      .run(chunks.length, documentId);

    logger.info({ documentId, chunks: chunks.length }, "索引完成"); // 成功指标
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e); // 可展示错误串
    database
      .prepare(
        // 任意异常：标记 failed 并写入 error_message 供前端展示
        `UPDATE documents SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(message, documentId);
    logger.error({ documentId, err: message }, "索引失败"); // 服务端日志
    throw e; // 可选：让 scheduleIngest 的 catch 再次记录（当前会）
  } finally {
    processing.delete(documentId); // 释放锁，允许后续 reindex
  }
}
