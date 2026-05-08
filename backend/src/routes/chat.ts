import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { retrieveContext } from "../services/retriever.js";
import { streamChatAnswer } from "../services/chat.js";
import { logger } from "../utils/logger.js";

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
});

function sendSse(reply: FastifyReply, payload: unknown) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function chatRoutes(app: FastifyInstance) {
  app.post(
    "/chat",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "message 必填" });
      }
      const { message } = parsed.data;

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        const { context } = await retrieveContext(message);
        for await (const chunk of streamChatAnswer(message, context)) {
          sendSse(reply, chunk);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error({ err: msg }, "问答流失败");
        sendSse(reply, { type: "error", message: msg });
      } finally {
        reply.raw.end();
      }
    }
  );
}
