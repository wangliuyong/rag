/**
 * 认证控制器：登录接口委托 auth.service，错误由全局 errorHandler 捕获。
 */
import type { Context } from "koa"; // ctx.request.body 已由 bodyparser 填充
import { loginService } from "../services/auth.service"; // 校验 + JWT

/**
 * POST /api/auth/login：JSON body { username, password }，成功返回 { token, username }。
 */
export async function login(ctx: Context): Promise<void> {
  const body = ctx.request.body; // unknown 形状，由 service 内 Zod 校验
  ctx.body = loginService(body); // 失败则抛 AppHttpError
}
