import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { authRoutes } from "../routes/auth.js";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(jwt, { secret: "test-secret" });
  await app.register(authRoutes);
  return app;
}

describe("authenticate middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("rejects requests without a token with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects requests with an invalid token with 401, not 500", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts a valid token and exposes the decoded payload", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "middleware-test",
        email: "middleware-test@example.com",
        password: "secret123",
      },
    });
    expect(register.statusCode).toBe(201);
    const { token } = register.json();

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe("middleware-test@example.com");
  });
});
