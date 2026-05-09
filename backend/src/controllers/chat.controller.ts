/**
 * 问答控制器：检索上下文后以 SSE 将模型 token 流式写给前端；失败时发送 type:error 事件。
 */
import type { Context } from "koa"; // ctx.req / ctx.res / ctx.request.body
import type { ServerResponse } from "node:http"; // 原始 res.write / end
import { retrieveContext } from "../services/retriever"; // 问题 → Qdrant 上下文
import { streamChatAnswer } from "../services/chat"; // DashScope 流式解析
import { logger } from "../utils/logger"; // 记录非预期异常

/** SSE 每条事件的 JSON 序列化前缀（与前端 assistantChat 解析约定一致） */
function writeSse(res: ServerResponse, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`); // 必须以 \n\n 结束一条事件
}

/**
 * POST /api/chat：JSON { message }；设置 text/event-stream，自行接管响应（ctx.respond = false）。
 */
export async function postChat(ctx: Context): Promise<void> {
  const raw = ctx.request.body as { message?: unknown } | undefined; // bodyparser 结果
  const message =
    typeof raw?.message === "string" ? raw.message.trim() : ""; // 统一成字符串
  if (!message) {
    ctx.status = 400; // 仍可走 Koa 默认 JSON（本分支未禁用 respond）
    ctx.body = { error: "message 不能为空" };
    return;
  }

  /** 禁止 Koa 在下游中间件返回后再自动写响应；改用手动 flush SSE */
  ctx.respond = false;
  const res = ctx.res; // Node ServerResponse
  ctx.status = 200; // 供日志与代理识别成功建立流
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8", // 标准 SSE MIME
    "Cache-Control": "no-cache, no-transform", // 禁用缓存与中间压缩变形
    Connection: "keep-alive", // 明示长连接（HTTP/1.1 默认亦可）
    "X-Accel-Buffering": "no", // Nginx 等反向代理关闭缓冲，尽快推送 token
  });

  try {
    const { context } = await retrieveContext(message); // 向量检索拼上下文（await 后再开始模型请求）

    for await (const chunk of streamChatAnswer(message, context)) {
      // async generator：逐块消费 DashScope SSE 解析结果
      if (chunk.type === "token") {
        writeSse(res, { type: "token", token: chunk.token }); // 前端拼接助手气泡
      }
      // type === 'done'：上游结束；前端仅依赖连接关闭或不再收到 token，可不单独发事件
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err); // 可读错误串
    logger.error({ err: msg }, "chat 流失败"); // 服务端完整上下文
    writeSse(res, { type: "error", message: msg }); // 前端 ElMessage / 气泡展示
  } finally {
    res.end(); // 结束 SSE；客户端 reader 收到 done
  }
}
