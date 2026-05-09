/**
 * 文档控制器：列表 / 上传 / 删除 / 重建索引；业务逻辑在 documents.service。
 */
import type { Context } from "koa"; // ctx.params / ctx.file
import {
  listDocuments,
  uploadDocument,
  removeDocument,
  reindexDocument,
} from "../services/documents.service"; // 纯函数服务层
import { AppHttpError } from "../utils/httpError"; // 与全局 errorHandler 对齐的 400

/**
 * GET /api/documents：返回 { items }，按更新时间倒序。
 */
export async function list(ctx: Context): Promise<void> {
  ctx.body = listDocuments(); // jwtAuth 已保证 ctx.state.user 存在
}

/**
 * POST /api/documents：multipart 字段名 `file`，内存缓冲后落盘并排队 ingest。
 */
export async function upload(ctx: Context): Promise<void> {
  ctx.body = await uploadDocument(ctx.file); // @koa/multer 注入 ctx.file
}

/**
 * DELETE /api/documents/:id：删 SQLite 行、磁盘文件与 Qdrant 点。
 */
export async function remove(ctx: Context): Promise<void> {
  const id = ctx.params.id; // 路由占位符
  if (!id) {
    throw new AppHttpError(400, { error: "缺少文档 id" }); // 理论上必有 id；兜底
  }
  ctx.body = await removeDocument(id);
}

/**
 * POST /api/documents/:id/reindex：状态置 pending 并再次 scheduleIngest。
 */
export async function reindex(ctx: Context): Promise<void> {
  const id = ctx.params.id;
  if (!id) {
    throw new AppHttpError(400, { error: "缺少文档 id" });
  }
  ctx.body = await reindexDocument(id);
}
