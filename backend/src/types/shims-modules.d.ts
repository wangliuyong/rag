/**
 * 无官方 @types 的 Koa 生态包：声明为 any 模块以满足 strict 下 import 解析。
 * 若后续安装 @types/koa__cors 等，可删除对应行。
 */
declare module "@koa/cors"; // 默认导出 (options?) => Middleware
declare module "@koa/multer"; // 默认导出 multer 工厂，与 express 版 multer API 一致
