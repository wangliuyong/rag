import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 80,
  separators: ["\n\n", "\n", "。", "；", "，", " ", ""],
});

export async function splitText(text: string): Promise<string[]> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks = await splitter.splitText(normalized);
  return chunks.map((c) => c.trim()).filter(Boolean);
}
