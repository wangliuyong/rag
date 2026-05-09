/** 问答路由：检索上下文后以 SSE 流式返回模型输出 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"; // 类型
import { z } from "zod"; // 校验 JSON body
import { retrieveContext } from "../services/retriever.js"; // 向量检索拼装上下文
import { streamChatAnswer } from "../services/chat.js"; // 调用 DashScope 流式补全
import { logger } from "../utils/logger.js"; // 错误日志

/** POST body：用户问题字符串，长度上限防止超大 prompt */
const bodySchema = z.object({
  message: z.string().min(1).max(8000), // 1～8000 字符
});

/**
 * 写入一条 SSE data 帧（结尾双换行符合 SSE 规范）。
 * @param reply Fastify 响应（已 hijack 为原始流）
 * @param payload 任意可 JSON 序列化的对象（token / done / error）
 */
function sendSse(reply: FastifyReply, payload: unknown) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`); // data: 前缀 + JSON + 空行分隔事件
}

/**
 * 注册 POST /chat：需 JWT；响应为 text/event-stream。
 * @param app Fastify 实例
 */
export async function chatRoutes(app: FastifyInstance) {
  app.post(
    "/chat",
    { preHandler: [app.authenticate] }, // 必须先通过 JWT
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = bodySchema.safeParse(request.body); // 校验 message
      if (!parsed.success) {
        return reply.status(400).send({ error: "message 必填" }); // 仍走常规 JSON 错误响应
      }
      const { message } = parsed.data; // 用户问题正文

      reply.hijack(); // 由业务完全接管响应流，不再使用 Fastify 默认序列化
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8", // 声明 SSE 与编码
        "Cache-Control": "no-cache, no-transform", // 禁止缓存与中间件缓冲变形
        Connection: "keep-alive", // 建议保持连接以持续推送 chunk
        "X-Accel-Buffering": "no", // Nginx：关闭代理缓冲以便实时下推
      });

      try {
        const { context } = await retrieveContext(message); // embedding + Qdrant 得到参考资料串
        for await (const chunk of streamChatAnswer(message, context)) {
          // 异步迭代器：逐块产出 token 或 done
          sendSse(reply, chunk); // 每块写一条 SSE 事件
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e); // 统一转字符串
        logger.error({ err: msg }, "问答流失败"); // 服务端记录
        sendSse(reply, { type: "error", message: msg }); // 客户端可解析的错误事件
      } finally {
        reply.raw.end(); // 无论成功失败都关闭底层 socket 写端
      }
    }
  );
}
