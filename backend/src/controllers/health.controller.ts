/**
 * 健康检查控制器：供运维 / 负载均衡探活，无需鉴权。
 */
import type { Context } from "koa"; // 仅使用 ctx.body / ctx.status

/**
 * GET /api/health：进程存活即返回 ok。
 */
export async function getHealth(ctx: Context): Promise<void> {
  ctx.body = { ok: true }; // 前端未强制使用，可与 curl / K8s probe 对接
}
