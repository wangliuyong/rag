/**
 * 文档领域服务：列表查询、multipart 落盘、删除文件与向量、触发重建索引。
 */
import {
  BadRequestException, // 400：未上传、MIME 不允许
  Injectable, // DI
  NotFoundException, // 404：id 不存在
} from "@nestjs/common";
import path from "node:path"; // join 路径
import { writeFile } from "node:fs/promises"; // 将内存 Buffer 一次性写入磁盘（上传文件适中场景）
import { mkdir, stat, unlink } from "node:fs/promises"; // 目录、元信息、删除
import { v4 as uuidv4 } from "uuid"; // 文档 id 与磁盘文件名前缀
import { getDb, type DocumentRow } from "../store/db"; // SQLite 与行类型
import { getEnv, resolveDataDir } from "../config/env"; // DATA_DIR
import { scheduleIngest } from "../services/ingest"; // 异步索引管线入口
import { deleteByDocumentId } from "../services/vectorStore"; // 按业务文档 id 删 Qdrant 点
import { logger } from "../utils/logger"; // 结构化日志
import { decodeMultipartFilename } from "../utils/multipartFilename"; // multipart 文件名 UTF-8 还原

/** 允许入库与解析的 MIME 集合（与 parser 分支一致） */
const ALLOWED_MIME = new Set([
  "application/pdf", // Adobe PDF
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // OOXML Word
]);

/**
 * MIME → 磁盘扩展名（仅两种合法 MIME）。
 * @param mime multipart 解析得到的 mimetype
 */
function extFromMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf"; // PDF 后缀
  return ".docx"; // 其余在白名单内必为 docx
}

@Injectable() // 由 DocumentsModule 注册为单例（默认 scope）
export class DocumentsService {
  /**
   * 返回全部文档元数据列表（不含磁盘路径），按更新时间倒序。
   */
  list(): { items: Omit<DocumentRow, "stored_name" | "file_path">[] } {
    const database = getDb(); // 连接单例
    const rows = database
      .prepare(
        `SELECT id, original_name, mime, size, status, chunk_count, error_message, created_at, updated_at
         FROM documents ORDER BY updated_at DESC` // 最新变动在前，便于前端列表
      )
      .all() as Omit<DocumentRow, "stored_name" | "file_path">[]; // 列表 API 不暴露内部路径
    return { items: rows }; // 与前端 axios 约定字段名 items
  }

  /**
   * 保存上传文件：校验 MIME → 写磁盘 → 插入 pending 行 → 排队 ingest。
   * @param file Multer 解析后的文件对象（memoryStorage 提供 buffer）
   */
  async upload(
    file: Express.Multer.File | undefined
  ): Promise<{
    id: string;
    original_name: string;
    mime: string;
    status: string;
  }> {
    if (!file) {
      throw new BadRequestException({ error: "未上传文件" }); // 客户端未带 file 字段
    }
    const mime = file.mimetype; // 浏览器报告的 MIME
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException({ error: "仅支持 PDF 或 DOCX" }); // 拒绝其它类型，避免解析崩溃
    }

    // Multer/Express 常把 UTF-8 文件名误当 latin1；此处还原中文等非 ASCII 显示名
    let originalName = decodeMultipartFilename(file.originalname);
    if (!originalName.trim()) {
      // 解码异常或空名时退回原始字段（去 NUL），避免违反业务「必须有展示名」
      originalName =
        (file.originalname && file.originalname.replace(/\0/g, "")) || "unnamed";
    }

    const env = getEnv(); // 含 DATA_DIR
    const dataDir = resolveDataDir(env); // 绝对路径根
    const uploadDir = path.join(dataDir, "uploads"); // 固定子目录名
    await mkdir(uploadDir, { recursive: true }); // 确保存在

    const id = uuidv4(); // 业务主键，同时用于文件名防冲突
    const ext = extFromMime(mime); // .pdf 或 .docx
    const storedName = `${id}${ext}`; // 磁盘文件名不含用户原始名，防止路径穿越与特殊字符
    const filePath = path.join(uploadDir, storedName); // 绝对路径字符串

    await writeFile(filePath, file.buffer); // 将内存 buffer 写入文件（multer memoryStorage）
    const st = await stat(filePath); // 确认大小（与 DB 一致）

    const database = getDb();
    database
      .prepare(
        `INSERT INTO documents (id, original_name, stored_name, mime, size, file_path, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')` // 初始状态 pending，由 ingest 推进
      )
      .run(id, originalName, storedName, mime, st.size, filePath); // original_name 为用户上传名（展示）

    scheduleIngest(id); // fire-and-forget：尽快 HTTP 201 返回，索引异步执行
    logger.info({ id, name: originalName }, "文档已上传，排队索引"); // 审计

    return {
      id, // 新建 id，前端可用于轮询或跳转
      original_name: originalName, // 已修正编码的原始文件名
      mime, // MIME 字符串
      status: "pending", // 当前状态枚举字符串
    };
  }

  /**
   * 删除文档：尽力删除磁盘文件 → 删除向量 → 删除 DB 行。
   * @param id documents.id
   */
  async remove(id: string): Promise<{ ok: boolean }> {
    const database = getDb();
    const row = database
      .prepare(`SELECT file_path FROM documents WHERE id = ?`) // 需要路径做 unlink
      .get(id) as { file_path: string } | undefined;
    if (!row) {
      throw new NotFoundException({ error: "文档不存在" }); // id 无效
    }
    try {
      await unlink(row.file_path); // 物理删除；失败则忽略（可能已被手动删）
    } catch {
      /* 静默：后续仍清理向量与元数据 */
    }
    await deleteByDocumentId(id); // Qdrant 按 payload.documentId 过滤删除
    database.prepare(`DELETE FROM documents WHERE id = ?`).run(id); // 元数据行删除
    return { ok: true }; // 成功语义
  }

  /**
   * 将文档状态重置为 pending 并再次调度 ingest（会先删旧向量再写入）。
   * @param id documents.id
   */
  async reindex(id: string): Promise<{ ok: boolean; status: string }> {
    const database = getDb();
    const row = database
      .prepare(`SELECT id FROM documents WHERE id = ?`) // 仅校验存在
      .get(id) as { id: string } | undefined;
    if (!row) {
      throw new NotFoundException({ error: "文档不存在" });
    }
    database
      .prepare(
        `UPDATE documents SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE id = ?` // 清空错误文案
      )
      .run(id);
    scheduleIngest(id); // 与上传后相同入口
    return { ok: true, status: "pending" }; // 告知前端当前状态机位置
  }
}
