/**
 * 应用根模块：导入业务子模块并注册全局控制器（健康检查）。
 */
import { Module } from "@nestjs/common"; // @Module 装饰器
import { AuthModule } from "./auth/auth.module"; // 登录与 JWT 模块
import { DocumentsModule } from "./documents/documents.module"; // 文档上传与列表
import { ChatModule } from "./chat/chat.module"; // 流式问答 SSE
import { AppController } from "./app.controller"; // /api/health

@Module({
  imports: [AuthModule, DocumentsModule, ChatModule], // 按依赖顺序聚合（模块间通过 exports/imports 解耦）
  controllers: [AppController], // 无业务前缀的健康检查挂在根
})
export class AppModule {} // 导出供 main.ts 中 NestFactory.create 使用
