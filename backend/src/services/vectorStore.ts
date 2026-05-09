/** Qdrant 向量库封装：客户端单例、建集合、写入、检索、按文档删除 */
import { QdrantClient } from "@qdrant/js-client-rest"; // 官方 REST 客户端
import { getEnv } from "../config/env"; // QDRANT_URL、COLLECTION、维度等
import { logger } from "../utils/logger"; // 建库信息日志

/** 模块级复用客户端，减少连接开销 */
let client: QdrantClient | null = null;

/**
 * 懒创建 QdrantClient。
 * @returns 指向环境变量所配置集群的客户端实例
 */
export function getQdrant(): QdrantClient {
  if (client) return client; // 已创建则返回
  const env = getEnv();
  client = new QdrantClient({ url: env.QDRANT_URL }); // 仅 URL，本地默认无鉴权
  return client;
}

/**
 * 若集合不存在则创建：向量维度与距离度量与入库向量一致；并为 documentId 建 keyword 索引以支持过滤删除。
 * @param vectorSize 单条向量的浮点维度数
 * @returns 实际使用的集合名称（来自环境变量）
 */
export async function ensureCollection(vectorSize: number): Promise<string> {
  const env = getEnv();
  const name = env.QDRANT_COLLECTION; // 集合名
  const q = getQdrant(); // 客户端
  const cols = await q.getCollections(); // 列出已有集合
  const exists = cols.collections.some((c) => c.name === name); // 名称匹配则视为已存在
  if (!exists) {
    await q.createCollection(name, {
      vectors: { size: vectorSize, distance: "Cosine" }, // 余弦距离与归一化向量常用组合
    });
    await q.createPayloadIndex(name, {
      field_name: "documentId", // payload 中的文档 id 字段
      field_schema: "keyword", // 精确匹配过滤
    });
    logger.info({ name, vectorSize }, "已创建 Qdrant collection"); // 运维可见
  }
  return name; // 调用方如需可记录日志
}

/** 写入 Qdrant 的 payload 结构：与检索、删除过滤字段一致 */
export type ChunkPayload = {
  documentId: string; // 业务文档 UUID
  filename: string; // 展示用原始文件名
  chunkIndex: number; // 片段在文档内序号（从 0）
  text: string; // 片段纯文本
};

/**
 * 批量 upsert 向量点：同一调用内 points 数组一次性提交（内部分片由 Qdrant 处理）。
 * @param points 含 UUID 点 id、向量、payload 的列表
 */
export async function upsertChunks(
  points: Array<{ id: string; vector: number[]; payload: ChunkPayload }>
): Promise<void> {
  if (points.length === 0) return; // 空数组不写库
  const env = getEnv();
  const q = getQdrant();
  await q.upsert(env.QDRANT_COLLECTION, {
    wait: true, // 等待服务端确认写入再返回，便于索引流程顺序正确
    points: points.map((p) => ({
      id: p.id, // 点 UUID（与文档 id 不同，为 chunk 级）
      vector: p.vector, // 浮点数组
      payload: p.payload as Record<string, unknown>, // SDK 类型为 Record
    })),
  });
}

/** 检索单条命中：含 Qdrant 点 id、相似度分数、反序列化后的 payload */
export type SearchHit = {
  id: string; // 向量点 id
  score: number; // 相似度（越大越相似，具体含义依距离定义）
  payload: ChunkPayload; // 业务字段
};

/**
 * 按查询向量相似度检索 Top limit 条。
 * @param vector 查询向量（与 collection 维度一致）
 * @param limit 返回条数上限
 */
export async function searchSimilar(
  vector: number[],
  limit: number
): Promise<SearchHit[]> {
  const env = getEnv();
  const q = getQdrant();
  const res = await q.search(env.QDRANT_COLLECTION, {
    vector, // 查询向量
    limit, // Top-K
    with_payload: true, // 需要带回文本与元数据
  });
  return res.map((r) => ({
    id: String(r.id), // 统一为字符串（Qdrant id 类型可能为 string | number）
    score: r.score ?? 0, // 无分数时给 0
    payload: r.payload as unknown as ChunkPayload, // 信任 schema；运行时由写入方保证
  }));
}

/**
 * 删除指定业务文档 id 关联的所有向量点（重建索引前清空旧向量）。
 * @param documentId documents 表主键
 */
export async function deleteByDocumentId(documentId: string): Promise<void> {
  const env = getEnv();
  const q = getQdrant();
  try {
    await q.delete(env.QDRANT_COLLECTION, {
      wait: true, // 等待删除完成
      filter: {
        must: [{ key: "documentId", match: { value: documentId } }], // payload 过滤
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("doesn't exist") || msg.includes("not found")) {
      return; // 集合或点不存在时视为幂等成功，避免首次索引失败
    }
    throw e; // 其它错误继续抛出
  }
}
