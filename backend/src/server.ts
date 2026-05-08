import path from "node:path";
import { mkdir } from "node:fs/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getEnv, resolveDataDir } from "./config/env.js";
import { getDb } from "./store/db.js";
import { logger } from "./utils/logger.js";
import { ensureCollection } from "./services/vectorStore.js";
import { authRoutes } from "./routes/auth.js";
import { documentRoutes } from "./routes/documents.js";
import { chatRoutes } from "./routes/chat.js";

async function seedAdmin() {
  const env = getEnv();
  const database = getDb();
  const row = database
    .prepare(`SELECT COUNT(*) as c FROM users`)
    .get() as { c: number };
  if (row.c > 0) return;
  const hash = bcrypt.hashSync(env.ADMIN_PASSWORD, 10);
  database
    .prepare(
      `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`
    )
    .run(uuidv4(), env.ADMIN_USERNAME, hash);
  logger.info({ username: env.ADMIN_USERNAME }, "已创建初始管理员账号");
}

async function buildServer() {
  const env = getEnv();
  const dataDir = resolveDataDir(env);
  await mkdir(dataDir, { recursive: true });
  await mkdir(path.join(dataDir, "uploads"), { recursive: true });

  getDb();
  await seedAdmin();
  await ensureCollection(env.EMBEDDING_DIMENSIONS);

  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 60 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  app.decorate(
    "authenticate",
    async function authenticate(request, reply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "未授权" });
      }
    }
  );

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.get("/api/health", async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(documentRoutes, { prefix: "/api" });
  await app.register(chatRoutes, { prefix: "/api" });

  return app;
}

const app = await buildServer();

try {
  const env = getEnv();
  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info({ port: env.PORT, host: env.HOST }, "服务已启动");
} catch (err) {
  logger.error(err);
  process.exit(1);
}
