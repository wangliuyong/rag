import { QdrantClient } from "@qdrant/js-client-rest";
import { getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

let client: QdrantClient | null = null;

export function getQdrant(): QdrantClient {
  if (client) return client;
  const env = getEnv();
  client = new QdrantClient({ url: env.QDRANT_URL });
  return client;
}

export async function ensureCollection(vectorSize: number): Promise<string> {
  const env = getEnv();
  const name = env.QDRANT_COLLECTION;
  const q = getQdrant();
  const cols = await q.getCollections();
  const exists = cols.collections.some((c) => c.name === name);
  if (!exists) {
    await q.createCollection(name, {
      vectors: { size: vectorSize, distance: "Cosine" },
    });
    await q.createPayloadIndex(name, {
      field_name: "documentId",
      field_schema: "keyword",
    });
    logger.info({ name, vectorSize }, "已创建 Qdrant collection");
  }
  return name;
}

export type ChunkPayload = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
};

export async function upsertChunks(
  points: Array<{ id: string; vector: number[]; payload: ChunkPayload }>
): Promise<void> {
  if (points.length === 0) return;
  const env = getEnv();
  const q = getQdrant();
  await q.upsert(env.QDRANT_COLLECTION, {
    wait: true,
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload as Record<string, unknown>,
    })),
  });
}

export type SearchHit = {
  id: string;
  score: number;
  payload: ChunkPayload;
};

export async function searchSimilar(
  vector: number[],
  limit: number
): Promise<SearchHit[]> {
  const env = getEnv();
  const q = getQdrant();
  const res = await q.search(env.QDRANT_COLLECTION, {
    vector,
    limit,
    with_payload: true,
  });
  return res.map((r) => ({
    id: String(r.id),
    score: r.score ?? 0,
    payload: r.payload as unknown as ChunkPayload,
  }));
}

export async function deleteByDocumentId(documentId: string): Promise<void> {
  const env = getEnv();
  const q = getQdrant();
  try {
    await q.delete(env.QDRANT_COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: "documentId", match: { value: documentId } }],
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("doesn't exist") || msg.includes("not found")) {
      return;
    }
    throw e;
  }
}
