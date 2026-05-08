import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "../store/db.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数无效" });
    }
    const { username, password } = parsed.data;
    const database = getDb();
    const row = database
      .prepare(
        `SELECT id, username, password_hash FROM users WHERE username = ?`
      )
      .get(username) as
      | { id: string; username: string; password_hash: string }
      | undefined;

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return reply.status(401).send({ error: "用户名或密码错误" });
    }

    const token = await reply.jwtSign({
      sub: row.id,
      username: row.username,
    });

    return { token, username: row.username };
  });
}
