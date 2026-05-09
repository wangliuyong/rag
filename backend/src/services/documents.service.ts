/**
 * 文档业务服务：列表、上传、删除、重建索引（原 Nest DocumentsService 逻辑平移）。
 */
import path from "node:path"; // 路径拼接
import { writeFile } from "node:fs/promises"; // Buffer 写盘
import { mkdir, stat, unlink } from "node:fs/promises"; // 目录与文件元数据
import { v4 as uuidv4 } from "uuid"; // 文档 id
import type { MemoryUploadedFile } from "../types/upload"; // 与 multer memoryStorage 字段对齐
import { getDb, type DocumentRow } from "../store/db"; // 数据库
import { getEnv, resolveDataDir } from "../config/env"; // DATA_DIR
import { scheduleIngest } from "./ingest"; // 异步向量化管线
import { deleteByDocumentId } from "./vectorStore"; // 删 Qdrant 点
import { logger } from "../utils/logger"; // 日志
import { decodeMultipartFilename } from "../utils/multipartFilename"; // 中文文件名修正
import { AppHttpError } from "../utils/httpError"; // 4xx 错误

/** 允许的 MIME 白名单 */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** MIME → 存储扩展名 */
function extFromMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  return ".docx";
}

/** 文档列表 */
export function listDocuments(): {
  items: Omit<DocumentRow, "stored_name" | "file_path">[];
} {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT id, original_name, mime, size, status, chunk_count, error_message, created_at, updated_at
       FROM documents ORDER BY updated_at DESC`
    )
    .all() as Omit<DocumentRow, "stored_name" | "file_path">[];
  return { items: rows };
}

/**
 * 处理上传文件（已由 @koa/multer 解析到内存）。
 * @param file ctx.file；未上传时为 undefined
 */
export async function uploadDocument(
  file: MemoryUploadedFile | undefined
): Promise<{
  id: string;
  original_name: string;
  mime: string;
  status: string;
}> {
  if (!file) {
    throw new AppHttpError(400, { error: "未上传文件" });
  }
  const mime = file.mimetype;
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppHttpError(400, { error: "仅支持 PDF 或 DOCX" });
  }

  let originalName = decodeMultipartFilename(file.originalname);
  if (!originalName.trim()) {
    originalName =
      (file.originalname && file.originalname.replace(/\0/g, "")) || "unnamed";
  }

  const env = getEnv();
  const dataDir = resolveDataDir(env);
  const uploadDir = path.join(dataDir, "uploads");
  await mkdir(uploadDir, { recursive: true });

  const id = uuidv4();
  const ext = extFromMime(mime);
  const storedName = `${id}${ext}`;
  const filePath = path.join(uploadDir, storedName);

  await writeFile(filePath, file.buffer);
  const st = await stat(filePath);

  const database = getDb();
  database
    .prepare(
      `INSERT INTO documents (id, original_name, stored_name, mime, size, file_path, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(id, originalName, storedName, mime, st.size, filePath);

  scheduleIngest(id);
  logger.info({ id, name: originalName }, "文档已上传，排队索引");

  return {
    id,
    original_name: originalName,
    mime,
    status: "pending",
  };
}

/** 删除文档及向量 */
export async function removeDocument(id: string): Promise<{ ok: boolean }> {
  const database = getDb();
  const row = database
    .prepare(`SELECT file_path FROM documents WHERE id = ?`)
    .get(id) as { file_path: string } | undefined;
  if (!row) {
    throw new AppHttpError(404, { error: "文档不存在" });
  }
  try {
    await unlink(row.file_path);
  } catch {
    /* 物理文件可能已不存在 */
  }
  await deleteByDocumentId(id);
  database.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
  return { ok: true };
}

/** 重置为 pending 并重新索引 */
export async function reindexDocument(id: string): Promise<{
  ok: boolean;
  status: string;
}> {
  const database = getDb();
  const row = database
    .prepare(`SELECT id FROM documents WHERE id = ?`)
    .get(id) as { id: string } | undefined;
  if (!row) {
    throw new AppHttpError(404, { error: "文档不存在" });
  }
  database
    .prepare(
      `UPDATE documents SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
    )
    .run(id);
  scheduleIngest(id);
  return { ok: true, status: "pending" };
}
