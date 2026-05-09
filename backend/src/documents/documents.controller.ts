/**
 * 文档 HTTP 控制器：CRUD 风格接口均挂 JwtAuthGuard；上传使用 multipart 字段名 file。
 */
import {
  Controller, // 类级别路由前缀
  Delete, // DELETE 动词
  Get, // GET 动词
  HttpCode, // 自定义状态码装饰器
  Param, // 路径参数 id
  Post, // POST 动词
  UploadedFile, // 注入 Multer 解析后的文件
  UseGuards, // 方法或类级别启用守卫
  UseInterceptors, // 注册拦截器（此处为文件上传）
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express"; // 单文件字段拦截器
import { memoryStorage } from "multer"; // 内存存储：得到 buffer，避免临时目录清理
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // JWT 校验守卫
import { DocumentsService } from "./documents.service"; // 领域逻辑

@Controller("documents") // 完整前缀 /api/documents（全局 api + documents）
@UseGuards(JwtAuthGuard) // 本控制器全部路由需登录（与 Fastify preHandler 等价）
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {} // 注入服务

  @Get() // GET /api/documents
  list() {
    return this.documents.list(); // 直接返回对象，Nest 序列化为 JSON
  }

  @Post() // POST /api/documents
  @HttpCode(201) // 创建成功使用 201 Created（默认 POST 为 201 若未指定则可能为 200，显式写明）
  @UseInterceptors(
    FileInterceptor("file", {
      // HTML form 字段名必须为 file，与前端 FormData.append('file', ...) 对齐
      limits: { fileSize: 50 * 1024 * 1024 }, // 单文件 50MB 上限，与旧 Fastify multipart 一致
      storage: memoryStorage(), // 不上磁盘临时文件，直接在内存 buffer 处理
    })
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    // UploadedFile 从请求中提取 Multer.File；未上传时为 undefined
    return this.documents.upload(file); // 异步 Promise<Service返回值>
  }

  @Delete(":id") // DELETE /api/documents/:id
  remove(@Param("id") id: string) {
    // Param 将路径段绑定到 id 字符串
    return this.documents.remove(id);
  }

  @Post(":id/reindex") // POST /api/documents/{id}/reindex；字面量 reindex 避免与其它 :id 子路由冲突
  reindex(@Param("id") id: string) {
    return this.documents.reindex(id);
  }
}
