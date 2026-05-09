/**
 * 业务层可抛出的 HTTP 错误：由全局 errorHandler 转为 JSON 响应（与旧 Nest 异常格式对齐）。
 */
/** 显式携带 HTTP 状态码与 JSON 响应体的错误类型 */
export class AppHttpError extends Error {
  /** HTTP 状态码，如 400、401、404 */
  readonly statusCode: number;

  /** 写入 ctx.body 的 JSON 对象 */
  readonly payload: Record<string, unknown>;

  /**
   * @param statusCode HTTP 状态码
   * @param payload 响应 JSON（前端通常读 error 字段）
   */
  constructor(statusCode: number, payload: Record<string, unknown>) {
    super(
      typeof payload.error === "string"
        ? payload.error
        : JSON.stringify(payload)
    ); // Error.message 便于日志
    this.name = "AppHttpError"; // 便于 instanceof 识别
    this.statusCode = statusCode; // 供中间件读取
    this.payload = payload; // 原样返回客户端
  }
}
