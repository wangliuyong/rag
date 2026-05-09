/** 文本分块：LangChain 递归字符切分，针对中文标点优化分隔符顺序 */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"; // 官方分块器实现

/** 模块级单例：避免重复构造 splitter（内部可复用状态） */
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500, // 单块目标字符数上限（约 Token 预算由上游模型决定）
  chunkOverlap: 80, // 相邻块重叠，减少边界处语义被切断
  separators: ["\n\n", "\n", "。", "；", "，", " ", ""], // 优先按段落、句读切分，最后退化为字符级
});

/**
 * 将长文本切为多条非空短串，供 embedding 批量写入。
 * @param text 解析后的整篇文档字符串
 * @returns 片段数组（已 trim 且过滤空串）
 */
export async function splitText(text: string): Promise<string[]> {
  const normalized = text.replace(/\r\n/g, "\n").trim(); // Windows 换行统一为 \n 并去首尾空白
  if (!normalized) return []; // 空文档不产生 chunk
  const chunks = await splitter.splitText(normalized); // 异步 API 与 LangChain 版本对齐
  return chunks.map((c) => c.trim()).filter(Boolean); // 去掉仅空白块，避免无意义向量
}
