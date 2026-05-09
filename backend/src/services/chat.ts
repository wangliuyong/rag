/** 对话服务：调用 DashScope OpenAI 兼容流式接口，解析 SSE 行为 async generator */
import { getEnv } from "../config/env.js"; // API Key、Base URL、模型名

/** 流式输出给前端的单条事件联合类型 */
export type StreamChunk =
  | { type: "token"; token: string } // 增量文本片段
  | { type: "done" }; // 流结束标记（与 OpenAI [DONE] 语义对齐后由本服务发出）

/**
 * 拼装系统提示词：约束模型仅依据参考资料回答并规定拒答话术。
 * @param context 由 retriever 拼好的多段引用文本（可为空串）
 */
function buildSystemPrompt(context: string): string {
  return `你是公司内部规章助手。严格基于下方「参考资料」回答员工问题。
要求：
1. 回答简洁、分条；涉及金额/时长/流程须与原文一致，勿臆测。
2. 若参考资料中找不到答案，回答：根据现有制度文档未找到相关规定，请联系 HR 确认。

参考资料：
${context || "（无检索结果）"}`; // 无检索时显式提示模型勿编造
}

/**
 * 以异步生成器形式流式返回模型 token，结束时 yield done。
 * @param userMessage 用户问题
 * @param context 检索得到的参考资料（已嵌入系统提示）
 */
export async function* streamChatAnswer(
  userMessage: string,
  context: string
): AsyncGenerator<StreamChunk> {
  const env = getEnv(); // 读取密钥与模型配置

  const url = `${env.DASHSCOPE_BASE_URL.replace(/\/$/, "")}/chat/completions`; // 去掉末尾斜杠再拼接路径
  const body = {
    model: env.CHAT_MODEL, // 如 qwen-plus
    stream: true, // 要求服务端以 SSE 块返回
    messages: [
      { role: "system", content: buildSystemPrompt(context) }, // 系统角色：制度助手人设 + 资料
      { role: "user", content: userMessage }, // 用户角色：实际问题
    ],
  };

  const res = await fetch(url, {
    method: "POST", // OpenAI 兼容 POST
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`, // DashScope API Key
      "Content-Type": "application/json", // JSON body
    },
    body: JSON.stringify(body), // 序列化请求体
  });

  if (!res.ok || !res.body) {
    const t = await res.text(); // 读取错误响应体便于排错
    throw new Error(`Chat HTTP ${res.status}: ${t}`); // 抛出给路由层转为 SSE error
  }

  const reader = res.body.getReader(); // 取得 Uint8Array 流读取器
  const decoder = new TextDecoder(); // UTF-8 解码器（支持 stream: true 分片）
  let buffer = ""; // 跨 chunk 的不完整行缓冲

  /**
   * 解析单行 SSE：以 `data: ` 开头；`[DONE]` 表示上游流结束。
   * @param line 可能含前缀空格的一行文本
   * @returns done 标记 / token 对象 / null 表示忽略
   */
  const processLine = (line: string) => {
    const trimmed = line.trim(); // 去掉首尾空白
    if (!trimmed.startsWith("data:")) return; // 非 data 行（如空行）忽略
    const data = trimmed.slice(5).trim(); // 去掉 `data:` 前缀后的 JSON 或 [DONE]
    if (data === "[DONE]") return "done" as const; // OpenAI 兼容结束标记
    try {
      const json = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>; // 仅解构关心的字段
      };
      const token = json.choices?.[0]?.delta?.content; // 流式增量一般在 delta.content
      if (token) return { type: "token" as const, token }; // 有内容则作为 token 事件
    } catch {
      /* ignore */ // 解析失败：可能是心跳或非标行，静默跳过
    }
    return null; // 无有效 token
  };

  while (true) {
    const { done, value } = await reader.read(); // 读取下一块二进制
    if (done) break; // 流结束则退出主循环
    buffer += decoder.decode(value, { stream: true }); // 追加解码文本，stream true 处理多字节字符截断
    const lines = buffer.split("\n"); // 按行切分
    buffer = lines.pop() ?? ""; // 最后一行可能不完整，留到下次与后续字节拼接
    for (const line of lines) {
      const out = processLine(line); // 逐完整行解析
      if (out === "done") {
        yield { type: "done" }; // 通知前端流结束
        return; // 结束生成器
      }
      if (out?.type === "token") yield out; // 向下游 yield 单 token
    }
  }

  for (const line of buffer.split("\n")) {
    const out = processLine(line); // 处理缓冲区剩余行（流结束后尾部）
    if (out === "done") {
      yield { type: "done" };
      return;
    }
    if (out?.type === "token") yield out;
  }

  yield { type: "done" }; // 若上游未显式 [DONE]，仍保证调用方收到结束信号
}
