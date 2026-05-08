import { getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

/** DashScope text-embedding-v3 等模型要求单次 input 条数 ≤ 10 */
const BATCH_SIZE = 10;

type EmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const env = getEnv();
  const url = `${env.DASHSCOPE_BASE_URL.replace(/\/$/, "")}/embeddings`;
  const results: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const body = {
      model: env.EMBEDDING_MODEL,
      input: batch,
      dimensions: env.EMBEDDING_DIMENSIONS,
    };

    let lastErr: Error | null = null;
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
          const t = await res.text();
          throw new Error(`Embedding HTTP ${res.status}: ${t}`);
        }
        const json = (await res.json()) as EmbeddingResponse;
        const sorted = [...json.data].sort((a, b) => a.index - b.index);
        sorted.forEach((row, idx) => {
          results[i + idx] = row.embedding;
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        logger.warn({ attempt, err: lastErr.message }, "Embedding 重试");
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    if (lastErr) throw lastErr;
  }

  return results;
}
