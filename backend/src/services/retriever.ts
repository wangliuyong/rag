import { embedTexts } from "./embeddings.js";
import { searchSimilar, type SearchHit } from "./vectorStore.js";

const TOP_K = 6;

export async function retrieveContext(query: string): Promise<{
  hits: SearchHit[];
  context: string;
}> {
  const [qvec] = await embedTexts([query]);
  if (!qvec) {
    return { hits: [], context: "" };
  }
  const merged = await searchSimilar(qvec, TOP_K);

  const lines = merged.map((h, i) => {
    const label = `${h.payload.filename}#片段${h.payload.chunkIndex + 1}`;
    return `[${i + 1}] ${label}\n${h.payload.text}`;
  });

  return {
    hits: merged,
    context: lines.join("\n\n---\n\n"),
  };
}
