/** 加载 @fastify/jwt 的类型副作用，合并到 fastify 类型空间 */
import "@fastify/jwt";
/** 从 fastify 引入请求/响应类型，供自定义实例方法签名使用 */
import type { FastifyRequest, FastifyReply } from "fastify";

/** 扩展 Fastify 实例类型：声明业务挂载的 authenticate 预处理器 */
declare module "fastify" {
  interface FastifyInstance {
    /** JWT 校验预处理器：成功则继续管道，失败则已发送 401 */
    authenticate: (
      request: FastifyRequest, // 当前 HTTP 请求
      reply: FastifyReply // 当前 HTTP 响应
    ) => Promise<void>; // 异步以支持 jwtVerify
  }
}
