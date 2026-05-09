/**
 * 全局探活接口：负载均衡或 K8s probe 可 GET /api/health。
 */
import { Controller, Get } from "@nestjs/common"; // 路由与方法装饰器

@Controller() // 无前缀路径段；全局前缀 api 后实际为 /api/health（若路径写 health）——见下方
export class AppController {
  @Get("health") // 完整路径 = 全局前缀 api + health => /api/health
  health(): { ok: boolean } {
    return { ok: true }; // 最小 JSON，表示进程与 Nest 管道可用（不检查外部 Qdrant）
  }
}
