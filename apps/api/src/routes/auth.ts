import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import bcrypt from "bcryptjs";
import { registerSchema, loginSchema, type AuthResponse } from "@acme/shared";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";

let userCounter = 0;

const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRY = "24h";

export async function authRoutes(app: FastifyInstance) {
  // global: false — only routes that opt in via config.rateLimit are limited.
  await app.register(rateLimit, { global: false });

  function signToken(user: { id: string; email: string }): string {
    return app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: TOKEN_EXPIRY }
    );
  }

  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { username, email, password } = parsed.data;

    // Accepted tradeoff (issue #14): this response confirms an email has an
    // account. Kept specific because the register flow also returns a
    // username-specific 409 (issue #13), so a generic message here would not
    // close the enumeration channel — only make the form less usable.
    if (db.users.getByEmail(email)) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    if (db.users.getByUsername(username)) {
      return reply.status(409).send({ error: "Username already taken" });
    }

    const id = `user-${++userCounter}`;
    const user = db.users.create({
      id,
      username,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });

    const response: AuthResponse = {
      token: signToken(user),
      user: { id: user.id, username: user.username, email: user.email },
    };

    return reply.status(201).send(response);
  });

  app.post(
    "/auth/login",
    // Per-IP limit to slow credential brute-forcing. 10/min is generous for a
    // human retyping a password and useless for a dictionary run.
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;
      const user = db.users.getByEmail(email);

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const response: AuthResponse = {
        token: signToken(user),
        user: { id: user.id, username: user.username, email: user.email },
      };

      return response;
    }
  );

  app.get(
    "/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const payload = request.user as { id: string; email: string };
      const user = db.users.getById(payload.id);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return { id: user.id, username: user.username, email: user.email };
    }
  );
}
