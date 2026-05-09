/**
 * 问答控制器：POST /api/chat，JWT 保护；响应为 text/event-stream（SSE），由业务直接写 res。
 */
import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common"; // Res 注入底层响应对象
import type { Response } from "express"; // Express Response 类型（含 raw、setHeader 等）
import { z } from "zod"; // 校验 JSON body.message
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // 与其它写接口一致需 Bearer
import { retrieveContext } from "../services/retriever"; // embedding + Qdrant → context 字符串
import { streamChatAnswer } from "../services/chat"; // DashScope 流式解析为 AsyncGenerator
import { logger } from "../utils/logger"; // 异常日志

/** 请求体：单字段 message，长度限制防止超大 prompt 消耗额度 */
const bodySchema = z.object({
  message: z.string().min(1).max(8000), // 至少 1 字符，最多 8000
});

@Controller("chat") // /api/chat
@UseGuards(JwtAuthGuard) // 未登录返回 401，不走 SSE
export class ChatController {
  /**
   * 流式问答：校验 body → 检索上下文 → 迭代生成器写 SSE → finally 关闭连接。
   * @param body 原始 body（json 中间件已解析为对象）
   * @param res passthrough: false 表示 Nest 不再自动发送响应，由本方法全权负责 res.end
   */
  @Post() // POST /api/chat
  async stream(
    @Body() body: unknown, // unknown：运行时 Zod 校验
    @Res({ passthrough: false }) res: Response // 注入 Express Response；关闭 passthrough 防止二次发送
  ): Promise<void> {
    const parsed = bodySchema.safeParse(body); // 安全解析
    if (!parsed.success) {
      res.status(400).json({ error: "message 必填" }); // 校验失败走普通 JSON（非 SSE）
      return; // 提前结束，勿进入流逻辑
    }
    const { message } = parsed.data; // 用户问题正文

    res.statusCode = 200; // 显式 200（writeHead 亦可）
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8"); // SSE MIME
    res.setHeader("Cache-Control", "no-cache, no-transform"); // 禁用缓存与代理缓冲变形
    res.setHeader("Connection", "keep-alive"); // 建议长连接推送
    res.setHeader("X-Accel-Buffering", "no"); // Nginx：禁用缓冲以便实时 flush

    const sendSse = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`); // SSE 规范：data: 行 + 空行结束事件
    };

    try {
      const { context } = await retrieveContext(message); // 异步：embedding API + Qdrant search
      for await (const chunk of streamChatAnswer(message, context)) {
        // chunk 为 { type:'token', token } 或 { type:'done' }
        sendSse(chunk); // 每个 chunk 一条 SSE 事件，前端 EventSource/fetch 可读
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); // 统一错误字符串
      logger.error({ err: msg }, "问答流失败"); // 服务端排查用
      sendSse({ type: "error", message: msg }); // 客户端 assistantChat store 可解析 type:error
    } finally {
      res.end(); // 关闭 writable 侧，结束 HTTP 响应
    }
  }
}
