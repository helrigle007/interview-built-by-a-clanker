import { describe, it, expect } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { authRoutes } from "./auth.js";

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(jwt, { secret: "test-secret" });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

function register(
  app: FastifyInstance,
  body: { username: string; email: string; password: string }
) {
  return app.inject({ method: "POST", url: "/auth/register", payload: body });
}

function login(app: FastifyInstance, body: { email: string; password: string }) {
  return app.inject({ method: "POST", url: "/auth/login", payload: body });
}

function usernameErrors(res: { json: () => any }): string[] {
  return res.json().error?.fieldErrors?.username ?? [];
}

describe("register input rules", () => {
  it("rejects a username containing spaces with a charset message", async () => {
    const app = await buildTestApp();
    const res = await register(app, {
      username: "bad name",
      email: "space@example.com",
      password: "secret1",
    });
    expect(res.statusCode).toBe(400);
    expect(usernameErrors(res).join(" ")).toMatch(/letters, numbers/i);
    await app.close();
  });

  it("rejects a username containing emoji", async () => {
    const app = await buildTestApp();
    const res = await register(app, {
      username: "user🔥",
      email: "emoji@example.com",
      password: "secret1",
    });
    expect(res.statusCode).toBe(400);
    expect(usernameErrors(res).length).toBeGreaterThan(0);
    await app.close();
  });

  it("accepts letters, digits, underscore, and hyphen", async () => {
    const app = await buildTestApp();
    const res = await register(app, {
      username: "Good_user-42",
      email: "good@example.com",
      password: "secret1",
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it("rejects a password longer than 72 characters", async () => {
    const app = await buildTestApp();
    const res = await register(app, {
      username: "longpassuser",
      email: "longpass@example.com",
      password: "a".repeat(73),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error?.fieldErrors?.password?.length).toBeGreaterThan(0);
    await app.close();
  });

  it("accepts a password of exactly 72 characters", async () => {
    const app = await buildTestApp();
    const res = await register(app, {
      username: "maxpassuser",
      email: "maxpass@example.com",
      password: "a".repeat(72),
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it("keeps the documented duplicate-email response", async () => {
    // Accepted tradeoff (issue #14): the duplicate-email 409 stays specific
    // because the register flow already returns a username-specific 409 (#13).
    const app = await buildTestApp();
    const first = await register(app, {
      username: "dupemail1",
      email: "dup-hardening@example.com",
      password: "secret1",
    });
    expect(first.statusCode).toBe(201);
    const second = await register(app, {
      username: "dupemail2",
      email: "dup-hardening@example.com",
      password: "secret1",
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("Email already registered");
    await app.close();
  });
});

describe("login rate limiting", () => {
  it("returns 429 after exceeding 10 attempts per minute from one IP", async () => {
    const app = await buildTestApp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await login(app, {
        email: "nobody@example.com",
        password: "wrongpass",
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
    await app.close();
  });

  it("does not rate limit registration", async () => {
    const app = await buildTestApp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await register(app, {
        username: `bulkuser${i}`,
        email: `bulk${i}@example.com`,
        password: "secret1",
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.every((s) => s === 201)).toBe(true);
    await app.close();
  });
});
