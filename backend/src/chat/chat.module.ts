/**
 * 问答模块：仅注册控制器；检索与 LLM 逻辑在 services 层，便于单测与复用。
 */
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module"; // JwtAuthGuard 依赖链
import { ChatController } from "./chat.controller";

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
})
export class ChatModule {}
