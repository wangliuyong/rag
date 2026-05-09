/**
 * 文档模块：依赖 AuthModule 以使用 JwtAuthGuard（守卫内需 JwtService 可选——守卫只用 verify，实际 JwtAuthGuard 已在 AuthModule export JwtModule）。
 */
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module"; // 导入以解析 JwtAuthGuard 对 JwtService 的依赖
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [AuthModule], // AuthModule exports JwtModule + JwtAuthGuard
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
