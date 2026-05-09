/**
 * NestJS 应用入口：准备数据目录与 SQLite、种子管理员、Qdrant 集合，再启动 HTTP 服务。
 */
import "reflect-metadata"; // 必须最先加载：为装饰器与 emitDecoratorMetadata 提供元数据支持
import { mkdir } from "node:fs/promises"; // 异步创建目录树
import path from "node:path"; // 路径拼接
import { NestFactory } from "@nestjs/core"; // 工厂：创建根应用实例
import { json } from "express"; // Express 中间件：解析 JSON body（Nest 默认底层为 Express）
import * as bcrypt from "bcryptjs"; // 密码哈希：与登录校验一致
import { v4 as uuidv4 } from "uuid"; // 生成用户主键等 UUID
import { AppModule } from "./app.module"; // 根模块：聚合功能模块
import { getEnv, resolveDataDir } from "./config/env"; // 环境变量校验与 DATA_DIR 解析
import { getDb } from "./store/db"; // SQLite 单例与迁移
import { ensureCollection } from "./services/vectorStore"; // Qdrant 集合就绪检查
import { logger } from "./utils/logger"; // pino 日志（启动失败等）

/**
 * 若 users 表为空，则插入一条管理员账号（用户名/密码来自环境变量）。
 * 幂等：已有任意用户则立即返回。
 */
async function seedAdmin(): Promise<void> {
  const env = getEnv(); // 读取缓存后的合法配置
  const database = getDb(); // 确保连接已建立
  const row = database
    .prepare(`SELECT COUNT(*) as c FROM users`) // 统计用户行数
    .get() as { c: number }; // 单行结果
  if (row.c > 0) return; // 已有用户，不写种子数据
  const hash = bcrypt.hashSync(env.ADMIN_PASSWORD, 10); // 同步 bcrypt，成本因子 10
  database
    .prepare(
      `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)` // 三列占位符
    )
    .run(uuidv4(), env.ADMIN_USERNAME, hash); // 执行插入
  logger.info({ username: env.ADMIN_USERNAME }, "已创建初始管理员账号"); // 运维可见审计日志
}

/**
 * 引导函数：创建全局目录 → DB → 种子 → 向量集合 → Nest 应用 → 监听端口。
 */
async function bootstrap(): Promise<void> {
  const env = getEnv(); // PORT、HOST、DATA_DIR、JWT、DashScope 等
  const dataDir = resolveDataDir(env); // 绝对路径数据根目录
  await mkdir(dataDir, { recursive: true }); // 不存在则创建（含父路径）
  await mkdir(path.join(dataDir, "uploads"), { recursive: true }); // 上传文件子目录

  getDb(); // 触发 SQLite 打开与 migrate
  await seedAdmin(); // 保证首次有可登录账号
  await ensureCollection(env.EMBEDDING_DIMENSIONS); // 向量维度与 collection 一致

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // 关闭内置 bodyParser，改用下方手动 json，以便统一加大体积上限
    rawBody: false, // 不需要原始 body（未做 webhook 验签）
  });
  app.enableCors({
    origin: true, // 反射 Origin：本地 Vite 任意端口可访问 API
    credentials: true, // 允许浏览器携带凭证类头
  });
  app.setGlobalPrefix("api"); // 所有控制器路由前缀 /api，与前端 /api 代理一致
  app.use(json({ limit: "60mb" })); // JSON 请求体上限 60MB（对齐原 Fastify bodyLimit）

  await app.listen(env.PORT, env.HOST); // 默认 0.0.0.0:3001
  logger.info({ port: env.PORT, host: env.HOST }, "NestJS 服务已启动"); // 启动成功
}

bootstrap().catch((err) => {
  logger.error(err); // 打印栈或错误对象
  process.exit(1); // 非零退出，便于容器/进程管理重启
});
