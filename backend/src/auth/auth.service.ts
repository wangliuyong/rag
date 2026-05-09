/**
 * 认证业务：校验用户名密码并签发 JWT（载荷含 sub、username）。
 */
import {
  BadRequestException, // 400：请求体字段不合法
  Injectable, // DI 标记
  UnauthorizedException, // 401：凭据错误
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt"; // 异步 signAsync 签发 token
import * as bcrypt from "bcryptjs"; // 与入库时相同的哈希比对
import { z } from "zod"; // 运行时校验登录 JSON
import { getDb } from "../store/db"; // SQLite 访问

/** POST /api/auth/login 的请求体 schema：两字段均非空字符串 */
const loginSchema = z.object({
  username: z.string().min(1), // 用户名至少 1 字符
  password: z.string().min(1), // 密码至少 1 字符
});

@Injectable() // 由 AuthModule.providers 注册
export class AuthService {
  constructor(private readonly jwt: JwtService) {} // 注入签发器

  /**
   * 登录主流程：校验 body → 查库 → 比对密码 → 签发 JWT。
   * @param body 原始请求体（unknown，避免信任前端类型）
   */
  async login(body: unknown): Promise<{ token: string; username: string }> {
    const parsed = loginSchema.safeParse(body); // 安全解析，不抛 ZodError 到外层
    if (!parsed.success) {
      throw new BadRequestException({ error: "参数无效" }); // 与旧 Fastify 行为一致
    }
    const { username, password } = parsed.data; // 解构已通过校验的字段
    const database = getDb(); // 获取单例连接
    const row = database
      .prepare(
        `SELECT id, username, password_hash FROM users WHERE username = ?` // 按用户名唯一索引查一行
      )
      .get(username) as // better-sqlite3 get 单行
      | { id: string; username: string; password_hash: string }
      | undefined; // 未注册则为 undefined

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      // 用户不存在或密码不匹配：统一文案，不泄露「用户是否存在」
      throw new UnauthorizedException({ error: "用户名或密码错误" });
    }

    const token = await this.jwt.signAsync({
      sub: row.id, // JWT 标准 subject：持久用户标识
      username: row.username, // 自定义声明：便于前端展示
    }); // 使用 JwtModule 配置的 secret 与 expiresIn

    return { token, username: row.username }; // Nest 序列化为 JSON 200
  }
}
