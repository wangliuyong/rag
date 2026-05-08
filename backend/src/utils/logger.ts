import pino from "pino";
import { getEnv } from "../config/env.js";

const env = (() => {
  try {
    return getEnv();
  } catch {
    return { NODE_ENV: "development" } as { NODE_ENV: string };
  }
})();

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }
      : undefined,
});
