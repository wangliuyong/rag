/** 认证路由：登录签发 JWT */
import type { FastifyInstance } from "fastify"; // 仅类型导入，避免运行时开销
import bcrypt from "bcryptjs"; // 与 seed 时相同的哈希算法，用于比对密码
import { z } from "zod"; // 校验 POST body 结构
import { getDb } from "../store/db.js"; // 查询 users 表

/** 登录请求体：用户名与密码均非空字符串 */
const loginSchema = z.object({
  username: z.string().min(1), // 至少 1 字符，避免空白登录
  password: z.string().min(1), // 至少 1 字符
});

/**
 * 注册 /auth/login：校验凭据后签发 JWT（载荷含 sub、username）。
 * @param app Fastify 实例（已注册 @fastify/jwt）
 */
export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body); // 安全解析 JSON body
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数无效" }); // 缺少字段或类型不符
    }
    const { username, password } = parsed.data; // 解构已通过校验的字段
    const database = getDb(); // 获取 SQLite
    const row = database
      .prepare(
        // 按用户名查一行：需要 id 用于 JWT sub，password_hash 用于比对
        `SELECT id, username, password_hash FROM users WHERE username = ?`
      )
      .get(username) as // 单行查询
      | { id: string; username: string; password_hash: string } // 命中时的列类型
      | undefined; // 未命中

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return reply.status(401).send({ error: "用户名或密码错误" }); // 统一错误文案，不泄露用户是否存在
    }

    const token = await reply.jwtSign({
      sub: row.id, // JWT subject：与用户主键绑定
      username: row.username, // 冗余用户名便于前端展示，勿单独信任需以 sub 为准
    }); // 异步签发（内部使用配置的 secret 与 expiresIn）

    return { token, username: row.username }; // Fastify 默认 200 + JSON 序列化
  });
}
