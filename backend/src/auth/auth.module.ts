/**
 * 认证模块：注册 JWT 模块、登录控制器、鉴权守卫；对外导出 JwtModule 与 JwtAuthGuard 供文档/问答模块使用。
 */
import { Module } from "@nestjs/common"; // 模块装饰器
import { JwtModule } from "@nestjs/jwt"; // 动态注册 JWT 密钥与过期策略
import { getEnv } from "../config/env"; // 读取 JWT_SECRET、JWT_EXPIRES_IN
import { AuthController } from "./auth.controller"; // HTTP 入口
import { AuthService } from "./auth.service"; // 登录逻辑
import { JwtAuthGuard } from "./jwt-auth.guard"; // 保护需登录接口

@Module({
  imports: [
    JwtModule.registerAsync({
      // 异步工厂：首次实例化 JwtModule 时拉取环境变量
      useFactory: () => {
        const env = getEnv(); // 抛错则进程应在更早阶段失败；此处假定已成功
        return {
          secret: env.JWT_SECRET, // HMAC 密钥
          signOptions: { expiresIn: env.JWT_EXPIRES_IN }, // 如 "7d"
        };
      },
    }),
  ],
  controllers: [AuthController], // 注册路由处理器
  providers: [AuthService, JwtAuthGuard], // 可注入类实例
  exports: [JwtModule, JwtAuthGuard], // 供 DocumentsModule、ChatModule import AuthModule 后使用守卫与 JwtService
})
export class AuthModule {}
