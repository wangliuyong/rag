/**
 * JWT 鉴权守卫：从 Authorization: Bearer <token> 解析并校验，失败返回 401 JSON。
 */
import {
  CanActivate, // 守卫接口：返回 boolean 或 Promise<boolean>
  ExecutionContext, // 包装当前请求上下文（HTTP / RPC / WS）
  Injectable, // 声明可由 Nest DI 容器实例化
  UnauthorizedException, // 401 异常，框架序列化为 JSON
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt"; // @nestjs/jwt 提供的签名与校验服务
import type { Request } from "express"; // Express 请求类型（platform-express）

@Injectable() // 注册为可注入提供者
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {} // 注入 JwtModule 注册的 JwtService

  /**
   * 在进入控制器方法前执行：校验通过则返回 true 并挂载 req.user。
   */
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>(); // 取出底层 Express Request
    const auth = req.headers.authorization; // 取 Authorization 头（可能 undefined）
    if (!auth?.startsWith("Bearer ")) {
      // 缺少 Bearer 前缀则视为未登录
      throw new UnauthorizedException({ error: "未授权" }); // 与前端约定的错误体字段名
    }
    try {
      const token = auth.slice(7); // 去掉前缀 "Bearer "，剩余为 JWT 字符串
      const payload = this.jwt.verify<{
        // verify 同步校验签名与过期时间
        sub: string; // 用户 id，与 DB users.id 对应
        username: string; // 展示用用户名
        iat?: number; // 签发时间戳（可选）
        exp?: number; // 过期时间戳（可选）
      }>(token);
      req.user = payload; // 供后续扩展：控制器内可读 req.user
      return true; // 放行到下一个管道（控制器）
    } catch {
      throw new UnauthorizedException({ error: "未授权" }); // 过期或篡改一律 401
    }
  }
}
