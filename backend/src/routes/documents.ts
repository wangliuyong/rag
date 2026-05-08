import type { FastifyInstance } from "fastify";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { v4 as uuidv4 } from "uuid";
import { getDb, type DocumentRow } from "../store/db.js";
import { getEnv, resolveDataDir } from "../config/env.js";
import { scheduleIngest } from "../services/ingest.js";
import { deleteByDocumentId } from "../services/vectorStore.js";
import { logger } from "../utils/logger.js";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  return ".docx";
}

export async function documentRoutes(app: FastifyInstance) {
  app.get(
    "/documents",
    { preHandler: [app.authenticate] },
    async (_request, reply) => {
      const database = getDb();
      const rows = database
        .prepare(
          `SELECT id, original_name, mime, size, status, chunk_count, error_message, created_at, updated_at
           FROM documents ORDER BY updated_at DESC`
        )
        .all() as Omit<DocumentRow, "stored_name" | "file_path">[];
      return reply.send({ items: rows });
    }
  );

  app.post(
    "/documents",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "未上传文件" });
      }
      const mime = data.mimetype;
      if (!ALLOWED_MIME.has(mime)) {
        return reply.status(400).send({ error: "仅支持 PDF 或 DOCX" });
      }

      const env = getEnv();
      const dataDir = resolveDataDir(env);
      const uploadDir = path.join(dataDir, "uploads");
      await mkdir(uploadDir, { recursive: true });

      const id = uuidv4();
      const ext = extFromMime(mime);
      const storedName = `${id}${ext}`;
      const filePath = path.join(uploadDir, storedName);

      const writeStream = createWriteStream(filePath);
      await pipeline(data.file, writeStream);
      const st = await stat(filePath);

      const database = getDb();
      database
        .prepare(
          `INSERT INTO documents (id, original_name, stored_name, mime, size, file_path, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`
        )
        .run(id, data.filename, storedName, mime, st.size, filePath);

      scheduleIngest(id);
      logger.info({ id, name: data.filename }, "文档已上传，排队索引");

      return reply.status(201).send({
        id,
        original_name: data.filename,
        mime,
        status: "pending",
      });
    }
  );

  app.delete(
    "/documents/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const database = getDb();
      const row = database
        .prepare(`SELECT file_path FROM documents WHERE id = ?`)
        .get(id) as { file_path: string } | undefined;
      if (!row) {
        return reply.status(404).send({ error: "文档不存在" });
      }
      try {
        await unlink(row.file_path);
      } catch {
        // 文件可能已删除
      }
      await deleteByDocumentId(id);
      database.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
      return reply.send({ ok: true });
    }
  );

  app.post(
    "/documents/:id/reindex",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const database = getDb();
      const row = database
        .prepare(`SELECT id FROM documents WHERE id = ?`)
        .get(id) as { id: string } | undefined;
      if (!row) {
        return reply.status(404).send({ error: "文档不存在" });
      }
      database
        .prepare(
          `UPDATE documents SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
        )
        .run(id);
      scheduleIngest(id);
      return reply.send({ ok: true, status: "pending" });
    }
  );
}
