import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";

// The middleware still reads ENFORCE_AUTH at import time on this branch;
// set it before the routes (and middleware) are imported so jwtVerify runs.
// Inert once the always-enforce change (#6) lands.
process.env.ENFORCE_AUTH = "true";
const { authRoutes } = await import("./auth.js");
const { db } = await import("../db.js");

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(jwt, { secret: "test-secret" });
  await app.register(authRoutes);
  return app;
}

let app: FastifyInstance;
let counter = 0;

function uniqueUser(overrides: Record<string, string> = {}) {
  counter++;
  return {
    username: `user${counter}`,
    email: `user${counter}@example.com`,
    password: "secret123",
    ...overrides,
  };
}

beforeAll(async () => {
  app = await buildApp();
});

async function register(payload: Record<string, string>) {
  return app.inject({ method: "POST", url: "/auth/register", payload });
}

async function login(payload: Record<string, string>) {
  return app.inject({ method: "POST", url: "/auth/login", payload });
}

describe("#7 password hashing uses a real KDF", () => {
  it("does not store the toy hashed_<int> format", async () => {
    const user = uniqueUser();
    const res = await register(user);
    expect(res.statusCode).toBe(201);
    const stored = db.users.getByEmail(user.email);
    expect(stored?.passwordHash).not.toMatch(/^hashed_-?\d+$/);
  });

  it("salts: same password, different stored hashes", async () => {
    const a = uniqueUser({ password: "same-password" });
    const b = uniqueUser({ password: "same-password" });
    await register(a);
    await register(b);
    const hashA = db.users.getByEmail(a.email)?.passwordHash;
    const hashB = db.users.getByEmail(b.email)?.passwordHash;
    expect(hashA).toBeDefined();
    expect(hashA).not.toBe(hashB);
  });

  it("login succeeds with the correct password, fails with a wrong one", async () => {
    const user = uniqueUser();
    await register(user);
    const ok = await login({ email: user.email, password: user.password });
    expect(ok.statusCode).toBe(200);
    const bad = await login({ email: user.email, password: "wrong-password" });
    expect(bad.statusCode).toBe(401);
  });
});

describe("#10 tokens expire", () => {
  it("register and login tokens both carry an exp claim", async () => {
    const user = uniqueUser();
    const reg = await register(user);
    const regPayload = app.jwt.decode<{ exp?: number }>(reg.json().token);
    expect(regPayload?.exp).toBeTypeOf("number");

    const log = await login({ email: user.email, password: user.password });
    const logPayload = app.jwt.decode<{ exp?: number }>(log.json().token);
    expect(logPayload?.exp).toBeTypeOf("number");
    // same expiry policy on both paths (within a small clock skew)
    expect(Math.abs((regPayload!.exp ?? 0) - (logPayload!.exp ?? 0))).toBeLessThan(10);
  });

  it("an expired token is rejected with 401", async () => {
    const user = uniqueUser();
    const reg = await register(user);
    const { id } = reg.json().user;
    const expired = app.jwt.sign({
      id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("#11 login response matches the AuthResponse contract", () => {
  it("includes the username", async () => {
    const user = uniqueUser();
    await register(user);
    const res = await login({ email: user.email, password: user.password });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe(user.username);
  });
});

describe("#12 email normalization", () => {
  it("register mixed-case, login lowercase", async () => {
    const user = uniqueUser({ email: "Mixed.Case@Example.COM" });
    const reg = await register(user);
    expect(reg.statusCode).toBe(201);
    expect(reg.json().user.email).toBe("mixed.case@example.com");

    const res = await login({
      email: "mixed.case@example.com",
      password: user.password,
    });
    expect(res.statusCode).toBe(200);
  });

  it("duplicate detection is case-insensitive", async () => {
    const res = await register(
      uniqueUser({ email: "MIXED.CASE@EXAMPLE.COM" }),
    );
    expect(res.statusCode).toBe(409);
  });

  it("stores the canonical lowercased email", async () => {
    const stored = db.users.getByEmail("mixed.case@example.com");
    expect(stored?.email).toBe("mixed.case@example.com");
  });

  it("trims surrounding whitespace", async () => {
    const user = uniqueUser({ email: "  Spacey@Example.com " });
    const reg = await register(user);
    expect(reg.statusCode).toBe(201);
    expect(reg.json().user.email).toBe("spacey@example.com");
  });
});
