/**
 * 进程入口：准备数据目录、种子管理员、SQLite、Qdrant 集合，再启动 HTTP 服务。
 */
import http from "node:http"; // 显式创建 Server，便于后续扩展 HTTPS / graceful shutdown
import path from "node:path"; // 拼接 uploads 子目录
import { mkdir } from "node:fs/promises"; // 异步创建目录（幂等 recursive）
import * as bcrypt from "bcryptjs"; // 种子用户密码哈希
import { v4 as uuidv4 } from "uuid"; // 用户主键
import { getEnv, resolveDataDir } from "./config/env"; // 配置（会先加载 dotenv）
import { getDb } from "./store/db"; // 触发迁移与连接
import { ensureCollection } from "./services/vectorStore"; // 启动时保证向量集合存在
import { logger } from "./utils/logger"; // 结构化日志
import { createApp } from "./app"; // Koa 应用

/**
 * 若库中尚无 ADMIN_USERNAME 对应用户，则插入一条 bcrypt 密码行（仅首次）。
 */
function seedAdminUser(): void {
  const env = getEnv(); // 读取 ADMIN_USERNAME / ADMIN_PASSWORD
  const database = getDb(); // 确保已 migrate
  const row = database
    .prepare(`SELECT id FROM users WHERE username = ?`)
    .get(env.ADMIN_USERNAME) as { id: string } | undefined;
  if (row) {
    return; // 已有管理员，跳过
  }
  const id = uuidv4(); // TEXT PRIMARY KEY
  const passwordHash = bcrypt.hashSync(env.ADMIN_PASSWORD, 10); // 同步哈希，启动阶段仅一次
  database
    .prepare(
      `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`
    )
    .run(id, env.ADMIN_USERNAME, passwordHash);
  logger.info({ username: env.ADMIN_USERNAME }, "已写入种子管理员账号");
}

/**
 * async IIFE：顶层 await 在非 ESM 构建下用立即执行的 async 函数代替。
 */
void (async function main() {
  const env = getEnv(); // 校验失败则抛错退出

  const dataDir = resolveDataDir(env); // DATA_DIR 绝对路径
  await mkdir(dataDir, { recursive: true }); // 确保 SQLite 父目录存在
  await mkdir(path.join(dataDir, "uploads"), { recursive: true }); // 上传文件目录

  seedAdminUser(); // 依赖 getDb 写入 users
  getDb(); // 若 seed 未调用则此处首次打开库；seed 内已打开则复用单例

  await ensureCollection(env.EMBEDDING_DIMENSIONS); // Qdrant 侧集合 + payload 索引

  const app = createApp(); // 组装中间件与路由
  const server = http.createServer(app.callback()); // Koa 桥接到 Node HTTP

  server.listen(env.PORT, env.HOST, () => {
    logger.info(
      { host: env.HOST, port: env.PORT },
      "Koa 服务已监听（API 前缀 /api）"
    );
  });
})();
