/** 环境变量：从 .env 加载，经 Zod 校验后导出类型安全的配置 */
import { config as loadEnv } from "dotenv"; // 将 .env 键值对注入 process.env
import { z } from "zod"; // 运行时模式校验库
import path from "node:path"; // 解析 .env 文件绝对路径

// 优先从当前工作目录（通常为 backend/）加载 .env
loadEnv({ path: path.resolve(process.cwd(), ".env") });
// 兼容在 monorepo 根目录放置单一 .env 的情况（从 backend 的上一级再加载一次）
loadEnv({ path: path.resolve(process.cwd(), "../.env") });

/** 所有进程级配置的 schema：缺省项带 default，必填项无 default */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"), // Node 运行环境
  PORT: z.coerce.number().default(3001), // HTTP 监听端口（字符串环境变量会转数字）
  HOST: z.string().default("0.0.0.0"), // 绑定网卡；0.0.0.0 表示所有接口
  DASHSCOPE_API_KEY: z.string().min(1, "DASHSCOPE_API_KEY 必填"), // 通义千问 / embedding 鉴权密钥
  DASHSCOPE_BASE_URL: z
    .string()
    .url()
    .default("https://dashscope.aliyuncs.com/compatible-mode/v1"), // OpenAI 兼容接口根 URL
  CHAT_MODEL: z.string().default("qwen-plus"), // 对话模型名
  EMBEDDING_MODEL: z.string().default("text-embedding-v3"), // 向量模型名
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024), // 向量维度，须与 Qdrant collection 一致
  QDRANT_URL: z.string().url().default("http://127.0.0.1:6333"), // Qdrant REST 地址
  QDRANT_COLLECTION: z.string().default("company_docs"), // 向量集合名称
  JWT_SECRET: z.string().min(8, "JWT_SECRET 至少 8 位"), // JWT HMAC 密钥
  JWT_EXPIRES_IN: z.string().default("7d"), // JWT 过期时间描述（jsonwebtoken 语法）
  ADMIN_USERNAME: z.string().default("admin"), // 种子管理员用户名
  ADMIN_PASSWORD: z.string().min(4, "ADMIN_PASSWORD 至少 4 位"), // 种子管理员明文密码（仅首次写入前存在于环境）
  DATA_DIR: z.string().default("./data"), // SQLite 与上传文件根目录（相对或绝对）
});

/** 由 Zod schema 推导的 TypeScript 类型，供其它模块引用 */
export type Env = z.infer<typeof envSchema>;

/** 解析成功后的配置缓存，避免重复 parse */
let cached: Env | null = null;

/**
 * 获取环境配置：首次调用时校验 process.env，失败抛错；后续返回缓存。
 * @returns 通过校验的 Env 对象
 */
export function getEnv(): Env {
  if (cached) return cached; // 命中缓存则直接返回
  const parsed = envSchema.safeParse(process.env); // 用 schema 校验当前环境变量全集
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors; // 提取各字段错误信息便于排错
    throw new Error(`环境变量校验失败: ${JSON.stringify(msg)}`); // 启动阶段失败应立刻暴露给运维
  }
  cached = parsed.data; // 写入缓存
  return cached; // 返回不可变语义上的配置快照
}

/**
 * 将 DATA_DIR 转为绝对路径：已是绝对路径则原样返回。
 * @param env 已校验的环境对象
 * @returns 数据目录绝对路径
 */
export function resolveDataDir(env: Env): string {
  if (path.isAbsolute(env.DATA_DIR)) return env.DATA_DIR; // 用户配置了绝对路径
  return path.resolve(process.cwd(), env.DATA_DIR); // 相对路径则相对进程 cwd 解析
}
