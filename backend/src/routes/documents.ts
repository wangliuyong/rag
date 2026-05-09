/** 文档路由：列表、上传、删除、重建索引（均需 JWT） */
import type { FastifyInstance } from "fastify"; // Fastify 类型
import path from "node:path"; // 拼接上传目录与文件路径
import { createWriteStream } from "node:fs"; // 创建可写流落盘
import { mkdir, stat, unlink } from "node:fs/promises"; // 异步目录创建、文件元信息、删除
import { pipeline } from "node:stream/promises"; // 将 multipart 可读流 pipe 到文件流
import { v4 as uuidv4 } from "uuid"; // 新文档主键与存储文件名前缀
import { getDb, type DocumentRow } from "../store/db.js"; // 数据库与行类型
import { getEnv, resolveDataDir } from "../config/env.js"; // 环境：数据目录
import { scheduleIngest } from "../services/ingest.js"; // 异步触发索引管线
import { deleteByDocumentId } from "../services/vectorStore.js"; // 删除 Qdrant 中该文档向量
import { logger } from "../utils/logger.js"; // 上传审计日志

/** 允许上传的 MIME 白名单：PDF 与 Word OOXML */
const ALLOWED_MIME = new Set([
  "application/pdf", // PDF
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

/**
 * 由 MIME 推断存储用扩展名（白名单已限两种）。
 * @param mime 请求中的 Content-Type / 解析得到的 mimetype
 */
function extFromMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf"; // PDF 扩展名
  return ".docx"; // 另一分支必为 docx
}

/**
 * 注册文档相关路由（前缀在 server 中已加 /api）。
 * @param app 已挂载 authenticate 的 Fastify 实例
 */
export async function documentRoutes(app: FastifyInstance) {
  app.get(
    "/documents", // GET 列表
    { preHandler: [app.authenticate] }, // 前置 JWT 校验
    async (_request, reply) => {
      const database = getDb(); // SQLite
      const rows = database
        .prepare(
          // 列表不返回敏感路径字段；按更新时间倒序
          `SELECT id, original_name, mime, size, status, chunk_count, error_message, created_at, updated_at
           FROM documents ORDER BY updated_at DESC`
        )
        .all() as Omit<DocumentRow, "stored_name" | "file_path">[]; // 断言行形状
      return reply.send({ items: rows }); // 包装为 { items } 与前端约定一致
    }
  );

  app.post(
    "/documents", // POST 单文件上传
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const data = await request.file(); // @fastify/multipart：取第一个文件字段
      if (!data) {
        return reply.status(400).send({ error: "未上传文件" }); // 无 multipart 文件
      }
      const mime = data.mimetype; // 浏览器/客户端提供的 MIME
      if (!ALLOWED_MIME.has(mime)) {
        return reply.status(400).send({ error: "仅支持 PDF 或 DOCX" }); // 拒绝其它类型
      }

      const env = getEnv(); // 读取 DATA_DIR
      const dataDir = resolveDataDir(env); // 绝对路径
      const uploadDir = path.join(dataDir, "uploads"); // 上传子目录固定名 uploads
      await mkdir(uploadDir, { recursive: true }); // 确保目录存在

      const id = uuidv4(); // 文档主键
      const ext = extFromMime(mime); // 与 MIME 对应的扩展名
      const storedName = `${id}${ext}`; // 磁盘文件名：避免原名冲突与路径穿越
      const filePath = path.join(uploadDir, storedName); // 绝对路径

      const writeStream = createWriteStream(filePath); // 创建目标文件写入流
      await pipeline(data.file, writeStream); // 流式拷贝 multipart 流到磁盘
      const st = await stat(filePath); // 获取实际写入字节数（与流结束一致）

      const database = getDb();
      database
        .prepare(
          // 初始状态 pending，由 ingest 异步改为 indexing/ready/failed
          `INSERT INTO documents (id, original_name, stored_name, mime, size, file_path, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`
        )
        .run(id, data.filename, storedName, mime, st.size, filePath); // data.filename 为原始展示名

      scheduleIngest(id); // 不 await：尽快响应客户端，索引在后台跑
      logger.info({ id, name: data.filename }, "文档已上传，排队索引"); // 结构化日志

      return reply.status(201).send({
        id, // 新建 id
        original_name: data.filename, // 原始文件名
        mime, // MIME
        status: "pending", // 当前状态
      }); // 201 Created
    }
  );

  app.delete(
    "/documents/:id", // REST 风格删除
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }; // 路径参数文档 id
      const database = getDb();
      const row = database
        .prepare(`SELECT file_path FROM documents WHERE id = ?`) // 查磁盘路径用于 unlink
        .get(id) as { file_path: string } | undefined;
      if (!row) {
        return reply.status(404).send({ error: "文档不存在" }); // 无此行
      }
      try {
        await unlink(row.file_path); // 删除物理文件
      } catch {
        // 文件可能已删除：忽略，仍清理向量与元数据
      }
      await deleteByDocumentId(id); // 按 documentId 过滤删除 Qdrant points
      database.prepare(`DELETE FROM documents WHERE id = ?`).run(id); // 删除元数据行
      return reply.send({ ok: true }); // 200 表示处理完成
    }
  );

  app.post(
    "/documents/:id/reindex", // 手动触发重新解析与向量写入
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }; // 文档 id
      const database = getDb();
      const row = database
        .prepare(`SELECT id FROM documents WHERE id = ?`) // 仅验证存在性
        .get(id) as { id: string } | undefined;
      if (!row) {
        return reply.status(404).send({ error: "文档不存在" });
      }
      database
        .prepare(
          // 重置为待索引并清空错误信息
          `UPDATE documents SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
        )
        .run(id);
      scheduleIngest(id); // 再次排队索引（ingest 内会先删旧向量再写新向量）
      return reply.send({ ok: true, status: "pending" }); // 告知前端当前状态
    }
  );
}
