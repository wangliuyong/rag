import { getEnv } from "../config/env.js";

export type StreamChunk =
  | { type: "token"; token: string }
  | { type: "done" };

function buildSystemPrompt(context: string): string {
  return `你是公司内部规章助手。严格基于下方「参考资料」回答员工问题。
要求：
1. 回答简洁、分条；涉及金额/时长/流程须与原文一致，勿臆测。
2. 若参考资料中找不到答案，回答：根据现有制度文档未找到相关规定，请联系 HR 确认。

参考资料：
${context || "（无检索结果）"}`;
}

export async function* streamChatAnswer(
  userMessage: string,
  context: string
): AsyncGenerator<StreamChunk> {
  const env = getEnv();

  const url = `${env.DASHSCOPE_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: env.CHAT_MODEL,
    stream: true,
    messages: [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: userMessage },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const t = await res.text();
    throw new Error(`Chat HTTP ${res.status}: ${t}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") return "done" as const;
    try {
      const json = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const token = json.choices?.[0]?.delta?.content;
      if (token) return { type: "token" as const, token };
    } catch {
      /* ignore */
    }
    return null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const out = processLine(line);
      if (out === "done") {
        yield { type: "done" };
        return;
      }
      if (out?.type === "token") yield out;
    }
  }

  for (const line of buffer.split("\n")) {
    const out = processLine(line);
    if (out === "done") {
      yield { type: "done" };
      return;
    }
    if (out?.type === "token") yield out;
  }

  yield { type: "done" };
}
