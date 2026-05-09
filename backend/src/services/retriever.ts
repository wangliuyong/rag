/** 检索服务：将用户问题向量化后在 Qdrant 中相似度搜索，拼成 LLM 上下文 */
import { embedTexts } from "./embeddings.js"; // 单条查询向量化
import { searchSimilar, type SearchHit } from "./vectorStore.js"; // 向量检索封装

/** 默认取最相似的 K 条片段，平衡上下文长度与召回 */
const TOP_K = 6;

/**
 * 根据用户问题检索向量库并格式化为带编号与出处的多段文本。
 * @param query 用户原始问题字符串
 * @returns hits 原始命中列表；context 拼好的大字符串供 chat 系统提示使用
 */
export async function retrieveContext(query: string): Promise<{
  hits: SearchHit[];
  context: string;
}> {
  const [qvec] = await embedTexts([query]); // 仅一条查询的 embedding；解构第一项
  if (!qvec) {
    return { hits: [], context: "" }; // 极端失败：无向量则空上下文
  }
  const merged = await searchSimilar(qvec, TOP_K); // Cosine 相似度 Top-K

  const lines = merged.map((h, i) => {
    const label = `${h.payload.filename}#片段${h.payload.chunkIndex + 1}`; // 人类可读来源标签（chunkIndex 从 0 起展示从 1）
    return `[${i + 1}] ${label}\n${h.payload.text}`; // 编号 + 换行 + 正文，便于模型引用
  });

  return {
    hits: merged, // 若后续要返回引用可复用（当前路由未用）
    context: lines.join("\n\n---\n\n"), // 段间分隔符与系统提示中的「参考资料」排版配合
  };
}
