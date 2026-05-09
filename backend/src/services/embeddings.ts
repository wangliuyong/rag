/** 文本向量化：调用 DashScope embeddings 接口，按 API 限制分批与重试 */
import { getEnv } from "../config/env.js"; // 模型、维度、密钥、URL
import { logger } from "../utils/logger.js"; // 重试告警

/** DashScope text-embedding-v3 等：单次请求 input 数组长度上限为 10 */
const BATCH_SIZE = 10;

/** OpenAI 兼容 embeddings 响应中关心的子集类型 */
type EmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>; // index 与请求中 input 顺序对应
};

/**
 * 将多条文本转为向量数组，顺序与输入一致。
 * @param texts 待向量化的字符串列表（空数组直接返回空）
 * @returns 与 texts 等长的 number[][]，第 i 项为第 i 条文本的向量
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []; // 无工作可做
  const env = getEnv(); // 环境配置
  const url = `${env.DASHSCOPE_BASE_URL.replace(/\/$/, "")}/embeddings`; // OpenAI 兼容 embeddings 路径
  const results: number[][] = new Array(texts.length); // 预分配与输入等长的结果槽

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE); // 当前批最多 BATCH_SIZE 条
    const body = {
      model: env.EMBEDDING_MODEL, // 如 text-embedding-v3
      input: batch, // 字符串数组
      dimensions: env.EMBEDDING_DIMENSIONS, // 显式指定维度（须与 Qdrant 配置一致）
    };

    let lastErr: Error | null = null; // 记录本批最后一次错误
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text(); // 读取服务端错误信息
          throw new Error(`Embedding HTTP ${res.status}: ${t}`); // 进入 catch 触发重试
        }
        const json = (await res.json()) as EmbeddingResponse; // 解析 JSON
        const sorted = [...json.data].sort((a, b) => a.index - b.index); // 按 index 排序防止乱序
        sorted.forEach((row, idx) => {
          results[i + idx] = row.embedding; // 写回全局 results 的正确偏移
        });
        lastErr = null; // 成功则清空错误
        break; // 跳出重试循环
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e)); // 归一为 Error
        logger.warn({ attempt, err: lastErr.message }, "Embedding 重试"); // 记录第几次失败
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); // 指数退避简单版：500ms、1000ms…
      }
    }
    if (lastErr) throw lastErr; // 三轮仍失败则向上抛出，索引任务标记 failed
  }

  return results; // 全部批次成功后的完整向量表
}
