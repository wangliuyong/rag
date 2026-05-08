import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "node:path";

// 从仓库根目录或 backend 目录加载 .env
loadEnv({ path: path.resolve(process.cwd(), ".env") });
loadEnv({ path: path.resolve(process.cwd(), "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DASHSCOPE_API_KEY: z.string().min(1, "DASHSCOPE_API_KEY 必填"),
  DASHSCOPE_BASE_URL: z
    .string()
    .url()
    .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
  CHAT_MODEL: z.string().default("qwen-plus"),
  EMBEDDING_MODEL: z.string().default("text-embedding-v3"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),
  QDRANT_URL: z.string().url().default("http://127.0.0.1:6333"),
  QDRANT_COLLECTION: z.string().default("company_docs"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET 至少 8 位"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().min(4, "ADMIN_PASSWORD 至少 4 位"),
  DATA_DIR: z.string().default("./data"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`环境变量校验失败: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  return cached;
}

export function resolveDataDir(env: Env): string {
  if (path.isAbsolute(env.DATA_DIR)) return env.DATA_DIR;
  return path.resolve(process.cwd(), env.DATA_DIR);
}
