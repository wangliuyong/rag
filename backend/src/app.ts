/**
 * Koa 应用工厂：中间件顺序敏感——错误处理须最先注册，其次跨域与解析体，最后挂载路由。
 */
import Koa from "koa"; // 核心 Application
import cors from "@koa/cors"; // Access-Control-Allow-* 
import bodyParser from "koa-bodyparser"; // JSON / form 解析到 ctx.request.body
import { errorHandler } from "./middleware/errorHandler"; // try/catch 整条下游链
import { createApiRouter } from "./routes"; // /api 下所有端点

/**
 * @returns 未监听端口的 Koa 实例，供 server.ts 创建 HTTP Server
 */
export function createApp(): Koa {
  const app = new Koa(); // 每个进程通常一个实例

  app.use(errorHandler()); // 必须在其它中间件之前：包裹后续 await next()

  app.use(
    cors({
      origin: "*", // 本地开发前端任意端口；生产可改为白名单
      credentials: false, // 与 origin * 组合时浏览器不发 Cookie，本 API 仅用 Bearer
    })
  );

  app.use(
    bodyParser({
      jsonLimit: "60mb", // 与上传上限同量级；问答 JSON 实际很小
      formLimit: "60mb", // 兼容少量 urlencoded 场景
      enableTypes: ["json", "form", "text"], // chat/login 使用 application/json
    })
  );

  const api = createApiRouter(); // 前缀 /api
  app.use(api.routes()); // 注册路由匹配
  app.use(api.allowedMethods()); // 405 Method Not Allowed / Allow 头

  return app;
}
