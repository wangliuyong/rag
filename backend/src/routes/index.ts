/**
 * API 路由汇总：统一前缀 `/api`，与前端 axios baseURL、Vite 代理一致。
 */
import Router from "@koa/router"; // 官方维护的 Koa 路由库
import multer from "@koa/multer"; // Koa 版 multer，上传文件挂 ctx.file
import { jwtAuth } from "../middleware/jwtAuth"; // 除 login / health 外文档与问答需登录
import * as health from "../controllers/health.controller";
import * as auth from "../controllers/auth.controller";
import * as documents from "../controllers/documents.controller";
import * as chat from "../controllers/chat.controller";

/** 内存存储：与 ingest 从磁盘读路径的逻辑衔接（controller 写 upload 目录） */
const upload = multer({
  storage: multer.memoryStorage(), // file.buffer 供 documents.service 写盘
  limits: { fileSize: 60 * 1024 * 1024 }, // 与 bodyparser jsonLimit 量级对齐（60MB）
});

/**
 * 创建挂载在 `/api` 下的路由器（再在 app 中 app.use(router.routes())）。
 */
export function createApiRouter(): Router {
  const router = new Router({ prefix: "/api" }); // 所有注册路径相对此前缀

  router.get("/health", health.getHealth); // 无需 JWT

  router.post("/auth/login", auth.login); // 颁发 JWT

  router.get("/documents", jwtAuth, documents.list); // 列表
  router.post(
    "/documents",
    jwtAuth,
    upload.single("file"),
    documents.upload
  ); // 字段名须与前端 FormData 一致
  router.delete("/documents/:id", jwtAuth, documents.remove); // RESTful 删除
  router.post("/documents/:id/reindex", jwtAuth, documents.reindex); // 异步重建

  router.post("/chat", jwtAuth, chat.postChat); // SSE，控制器内 ctx.respond = false

  return router;
}
