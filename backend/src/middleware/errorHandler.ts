/**
 * 全局错误处理中间件：须第一个 `app.use`，用 try/catch 包裹后续整条中间件链。
 */
import type { Context, Next } from "koa"; // Koa 上下文与 next 函数类型
import { AppHttpError } from "../utils/httpError"; // 业务显式错误
import { logger } from "../utils/logger"; // 未预期错误打日志

/**
 * 返回 Koa 中间件：捕获任意抛错，映射为 JSON 与合适状态码。
 */
export function errorHandler() {
  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      await next(); // 继续向内执行路由与业务
    } catch (err: unknown) {
      if (err instanceof AppHttpError) {
        // 业务可预期错误：按 statusCode 与 payload 返回
        ctx.status = err.statusCode; // 如 400、401
        ctx.body = err.payload; // 如 { error: "..." }
        return; // 不再向上抛
      }
      logger.error({ err }, "未处理异常"); // 5xx 前记录堆栈
      ctx.status = 500; // 内部错误
      ctx.body = { error: "服务器内部错误" }; // 不向外暴露细节
    }
  };
}
