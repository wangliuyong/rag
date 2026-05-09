/**
 * 扩展 Express Request：JWT 校验通过后由守卫写入 user，供后续守卫或控制器读取（当前业务未强依赖）。
 */
export {};

declare global {
  namespace Express {
    interface Request {
      /** JwtAuthGuard 校验成功后挂载的载荷（sub、username 等） */
      user?: { sub: string; username: string; iat?: number; exp?: number };
    }
  }
}
