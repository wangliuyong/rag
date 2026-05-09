/**
 * 扩展 Koa 默认 ctx.state，便于 JWT 中间件挂载用户信息（类型感知）。
 */
import "koa";

declare module "koa" {
  interface DefaultState {
    /** jwtAuth 中间件校验通过后写入的 JWT 载荷 */
    user?: { sub: string; username: string; iat?: number; exp?: number };
  }
}
