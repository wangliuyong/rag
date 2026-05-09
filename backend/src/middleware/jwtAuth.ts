/**
 * JWT 鉴权中间件：从 Authorization: Bearer 提取 token，校验后写入 ctx.state.user。
 */
import type { Context, Next } from "koa"; // Koa 类型
import jwt from "jsonwebtoken"; // 与 auth.service 签发使用同一 secret
import { getEnv } from "../config/env"; // JWT_SECRET
import { AppHttpError } from "../utils/httpError"; // 统一 401 响应体

/**
 * 保护需登录接口：无 token 或校验失败时抛 AppHttpError(401)。
 */
export async function jwtAuth(ctx: Context, next: Next): Promise<void> {
  const header = ctx.get("Authorization"); // 读取头（Koa 大小写不敏感）
  if (!header?.startsWith("Bearer ")) {
    // 未带 Bearer 前缀
    throw new AppHttpError(401, { error: "未授权" });
  }
  const token = header.slice(7).trim(); // 去掉 "Bearer " 前缀
  if (!token) {
    throw new AppHttpError(401, { error: "未授权" });
  }
  try {
    const env = getEnv(); // 同步读缓存配置
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      // verify 抛错则进 catch
      sub: string;
      username: string;
      iat?: number;
      exp?: number;
    };
    ctx.state.user = payload; // 供后续中间件/控制器只读使用
    await next(); // 放行
  } catch {
    throw new AppHttpError(401, { error: "未授权" }); // 过期、签名错误等
  }
}
