/**
 * 扩展 Koa Context：@koa/multer 在上传成功后会把解析到的文件挂在 ctx.file（内存存储时为 Buffer）。
 */
import type { MemoryUploadedFile } from "./upload"; // 本地形状，免安装 multer 类型包

declare module "koa" {
  interface DefaultContext {
    /** upload.single('file') 成功后由 multer 注入；未上传或字段名错误时为 undefined */
    file?: MemoryUploadedFile;
  }
}
