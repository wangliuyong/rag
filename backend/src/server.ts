/** HTTP 服务入口：组装 Fastify、插件、路由并监听端口 */
import path from "node:path"; // 提供 join / resolve 等路径工具
import { mkdir } from "node:fs/promises"; // 异步创建目录，不阻塞事件循环
import Fastify from "fastify"; // Web 框架核心
import cors from "@fastify/cors"; // 跨域插件
import multipart from "@fastify/multipart"; // 解析 multipart/form-data（文件上传）
import jwt from "@fastify/jwt"; // JWT 签发与校验
import bcrypt from "bcryptjs"; // 密码哈希（与登录校验算法一致）
import { v4 as uuidv4 } from "uuid"; // 生成全局唯一主键（用户 id 等）
import { getEnv, resolveDataDir } from "./config/env.js"; // 读取并校验环境变量；解析数据目录绝对路径
import { getDb } from "./store/db.js"; // 获取 SQLite 单例并完成迁移
import { logger } from "./utils/logger.js"; // 结构化日志（pino）
import { ensureCollection } from "./services/vectorStore.js"; // 确保 Qdrant 集合存在且维度正确
import { authRoutes } from "./routes/auth.js"; // 认证相关路由
import { documentRoutes } from "./routes/documents.js"; // 文档 CRUD 与上传
import { chatRoutes } from "./routes/chat.js"; // 流式问答 SSE

/**
 * 若数据库中尚无用户，则插入一条管理员账号（密码来自环境变量）。
 * 仅在首次启动或清空库后执行一次有效写入。
 */
async function seedAdmin() {
  const env = getEnv(); // 读取已校验的环境配置（含 ADMIN_*）
  const database = getDb(); // 打开/复用 SQLite 连接
  const row = database
    .prepare(`SELECT COUNT(*) as c FROM users`) // 预编译 SQL：统计用户行数
    .get() as { c: number }; // 单行结果断言为 { c }
  if (row.c > 0) return; // 已有用户则跳过，避免重复种子数据
  const hash = bcrypt.hashSync(env.ADMIN_PASSWORD, 10); // 同步哈希管理员密码，成本因子 10
  database
    .prepare(
      // 插入管理员：id 随机，用户名与哈希来自环境变量
      `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`
    )
    .run(uuidv4(), env.ADMIN_USERNAME, hash); // 执行插入
  logger.info({ username: env.ADMIN_USERNAME }, "已创建初始管理员账号"); // 记录审计信息
}

/**
 * 创建并配置 Fastify 实例：目录、数据库、向量库、插件、鉴权装饰器、路由。
 * @returns 已 register 全部路由、可直接 listen 的 app
 */
async function buildServer() {
  const env = getEnv(); // 全局配置单例
  const dataDir = resolveDataDir(env); // 数据根目录（绝对路径）
  await mkdir(dataDir, { recursive: true }); // 确保数据根存在（含多级父目录）
  await mkdir(path.join(dataDir, "uploads"), { recursive: true }); // 确保上传子目录存在

  getDb(); // 初始化 SQLite 与表结构（幂等）
  await seedAdmin(); // 确保至少有一个管理员（若库为空）
  await ensureCollection(env.EMBEDDING_DIMENSIONS); // 确保 Qdrant collection 与 embedding 维度一致

  const app = Fastify({
    loggerInstance: logger, // 与业务共用 pino，日志字段一致
    bodyLimit: 60 * 1024 * 1024, // 请求体最大 60MB（JSON 等非文件场景上限）
  });

  await app.register(cors, {
    origin: true, // 反射请求 Origin，开发时前端任意端口可访问
    credentials: true, // 允许携带 Cookie / Authorization（若浏览器需要）
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET, // 签名密钥（须足够长且保密）
    sign: { expiresIn: env.JWT_EXPIRES_IN }, // 默认签发有效期，如 "7d"
  });

  app.decorate(
    "authenticate", // 在实例上挂载名为 authenticate 的预处理器
    async function authenticate(request, reply) {
      try {
        await request.jwtVerify(); // 校验 Authorization Bearer 中的 JWT
      } catch {
        return reply.status(401).send({ error: "未授权" }); // 校验失败返回 401 JSON
      }
    }
  );

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 单个上传文件最大 50MB
  });

  app.get("/api/health", async () => ({ ok: true })); // 健康检查，供负载均衡或编排探活

  await app.register(authRoutes, { prefix: "/api" }); // 挂载 /api/auth/*
  await app.register(documentRoutes, { prefix: "/api" }); // 挂载 /api/documents*
  await app.register(chatRoutes, { prefix: "/api" }); // 挂载 /api/chat

  return app; // 返回已配置完成的实例
}

const app = await buildServer(); // 顶层 await：在模块加载阶段完成异步组装

try {
  const env = getEnv(); // 再次读取（已缓存）用于端口与 host
  await app.listen({ port: env.PORT, host: env.HOST }); // 绑定监听：默认 0.0.0.0:3001
  logger.info({ port: env.PORT, host: env.HOST }, "服务已启动"); // 启动成功日志
} catch (err) {
  logger.error(err); // 打印监听失败原因（端口占用等）
  process.exit(1); // 非零退出码，便于进程管理器重启或告警
}
