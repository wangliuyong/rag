/**
 * 内存上传文件形状：与 multer memoryStorage 写入 ctx.file 的字段一致，避免依赖 multer 包类型。
 */
export type MemoryUploadedFile = {
  /** 表单字段名，本项目中为 `file` */
  fieldname: string;
  /** 用户原始文件名（可能需 decodeMultipartFilename 修正编码） */
  originalname: string;
  encoding: string;
  /** MIME，用于白名单校验 */
  mimetype: string;
  /** 文件字节内容 */
  buffer: Buffer;
  /** buffer.length */
  size: number;
};
