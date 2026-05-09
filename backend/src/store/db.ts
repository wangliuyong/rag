/** SQLite 连接与表结构迁移：单进程单例 */
import Database from "better-sqlite3"; // 同步 SQLite 驱动，适合本服务负载模型
import path from "node:path"; // 拼接数据库文件路径
import { resolveDataDir, getEnv } from "../config/env"; // 数据目录与环境
import { logger } from "../utils/logger"; // 连接成功日志

/** 模块级单例：避免重复打开同一 db 文件 */
let db: Database.Database | null = null;

/**
 * 懒初始化数据库：首次调用时打开文件、设置 WAL、执行迁移。
 * @returns 已就绪的 Database 实例
 */
export function getDb(): Database.Database {
  if (db) return db; // 已打开则直接返回单例
  const env = getEnv(); // 需要 DATA_DIR 解析路径
  const dataDir = resolveDataDir(env); // 绝对路径数据目录
  const dbPath = path.join(dataDir, "app.db"); // 库文件固定名为 app.db
  db = new Database(dbPath); // 打开（不存在则创建）数据库文件
  db.pragma("journal_mode = WAL"); // 写前日志模式，提升并发读与崩溃恢复
  migrate(db); // 执行/幂等创建表与索引
  logger.info({ dbPath }, "SQLite 已连接"); // 记录实际路径便于排查挂载问题
  return db; // 返回给调用方
}

/**
 * 执行 DDL：IF NOT EXISTS 保证重复调用安全。
 * @param database 已打开的 better-sqlite3 实例
 */
function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','indexing','ready','failed')),
      chunk_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  `); // 整段 SQL 一次执行；索引加速按状态筛选与轮询
}

/** documents 表完整行映射（与 SELECT * 对齐；列表接口可能省略部分列） */
export type DocumentRow = {
  id: string; // 文档 UUID
  original_name: string; // 用户上传时的原始文件名
  stored_name: string; // 磁盘上的存储文件名（通常 id+扩展名）
  mime: string; // MIME 类型，用于解析器分支
  size: number; // 字节大小
  file_path: string; // 磁盘绝对路径
  status: "pending" | "indexing" | "ready" | "failed"; // 索引生命周期状态
  chunk_count: number; // 成功写入 Qdrant 的片段数量
  error_message: string | null; // 失败时的错误文案
  created_at: string; // ISO 风格时间字符串（SQLite datetime）
  updated_at: string; // 最后更新时间
};
