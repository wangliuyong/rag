/**
 * 认证业务服务：登录校验与 JWT 签发（无框架依赖，供控制器调用）。
 */
import * as bcrypt from "bcryptjs"; // 密码哈希比对
import jwt, { type SignOptions } from "jsonwebtoken"; // 同步 sign；SignOptions 消除 expiresIn 字面量推断问题
import { z } from "zod"; // 请求体验证
import { getDb } from "../store/db"; // users 表
import { getEnv } from "../config/env"; // JWT_SECRET、过期时间
import { AppHttpError } from "../utils/httpError"; // 400/401

/** 登录 JSON 的 Zod 模式 */
const loginSchema = z.object({
  username: z.string().min(1), // 非空用户名
  password: z.string().min(1), // 非空密码
});

/**
 * 校验凭据并返回 token + 用户名。
 * @param body 控制器传入的 ctx.request.body（已由 bodyparser 解析）
 */
export function loginService(body: unknown): {
  token: string;
  username: string;
} {
  const parsed = loginSchema.safeParse(body); // 安全解析
  if (!parsed.success) {
    throw new AppHttpError(400, { error: "参数无效" }); // 字段缺失或类型不对
  }
  const { username, password } = parsed.data; // 解构合法字段
  const database = getDb(); // SQLite 单例
  const row = database
    .prepare(
      `SELECT id, username, password_hash FROM users WHERE username = ?` // 唯一用户名查一行
    )
    .get(username) as
    | { id: string; username: string; password_hash: string }
    | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    // 防枚举：统一错误文案
    throw new AppHttpError(401, { error: "用户名或密码错误" });
  }

  const env = getEnv(); // JWT 配置
  const signOpts: SignOptions = {
    // jsonwebtoken v9 + @types 将 expiresIn 收窄为 ms.StringValue；环境变量为 string 时需断言
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  const token = jwt.sign(
    {
      sub: row.id, // 标准 subject
      username: row.username, // 自定义声明
    },
    env.JWT_SECRET, // HMAC 密钥
    signOpts
  );

  return { token, username: row.username }; // 控制器赋给 ctx.body
}
