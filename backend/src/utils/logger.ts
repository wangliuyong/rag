/** 应用级日志：开发环境美化输出，生产仅 JSON */
import pino from "pino"; // 高性能结构化日志库
import { getEnv } from "../config/env"; // 读取 NODE_ENV 决定日志级别与 transport

/**
 * 模块加载时立即解析环境：若 .env 尚未就绪导致 getEnv 抛错，
 * 则退化为 development，避免 logger 自身初始化失败。
 */
const env = (() => {
  try {
    return getEnv(); // 正常路径：完整 Env
  } catch {
    return { NODE_ENV: "development" } as { NODE_ENV: string }; // 降级：仅提供 NODE_ENV
  }
})();

/** 全局导出的 logger 实例，供路由与服务写入日志 */
export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info", // 开发打印更详细
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty", // 人类可读格式
          options: { colorize: true, translateTime: "SYS:standard" }, // 彩色与时间翻译
        }
      : undefined, // 生产使用默认 JSON 行输出，便于采集
});
