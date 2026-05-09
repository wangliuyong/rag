/**
 * 认证 HTTP 控制器：暴露 POST /api/auth/login（全局前缀在 main 中配置）。
 */
import { Body, Controller, Post } from "@nestjs/common"; // Body 管道解析 JSON；Post 路由方法
import { AuthService } from "./auth.service"; // 业务委托

@Controller("auth") // 路径前缀 auth；完整基路径为 /api/auth
export class AuthController {
  constructor(private readonly auth: AuthService) {} // 构造函数注入服务

  @Post("login") // HTTP POST /api/auth/login
  login(@Body() body: unknown) {
    // body 由上方 json 中间件解析；类型 unknown 交由 AuthService 内 Zod 校验
    return this.auth.login(body); // 返回 Promise，Nest 自动 await 并写响应
  }
}
