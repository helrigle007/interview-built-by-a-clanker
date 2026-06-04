import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("POST /auth/register username uniqueness", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a username that is already taken with 409", async () => {
    const first = await register(app, {
      username: "TakenName",
      email: "taken-1@example.com",
      password: "secret1",
    });
    expect(first.statusCode).toBe(201);

    const second = await register(app, {
      username: "TakenName",
      email: "taken-2@example.com",
      password: "secret2",
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("Username already taken");
  });

  it("treats usernames as case-insensitive for uniqueness", async () => {
    const first = await register(app, {
      username: "Citrine",
      email: "citrine-1@example.com",
      password: "secret1",
    });
    expect(first.statusCode).toBe(201);

    const second = await register(app, {
      username: "citrine",
      email: "citrine-2@example.com",
      password: "secret2",
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("Username already taken");
  });

  it("preserves the casing entered at registration for display", async () => {
    const res = await register(app, {
      username: "MixedCaseUser",
      email: "mixed@example.com",
      password: "secret1",
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.username).toBe("MixedCaseUser");
  });

  it("still rejects duplicate emails with the email-specific message", async () => {
    const first = await register(app, {
      username: "emailuser1",
      email: "dup@example.com",
      password: "secret1",
    });
    expect(first.statusCode).toBe(201);

    const second = await register(app, {
      username: "emailuser2",
      email: "dup@example.com",
      password: "secret2",
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("Email already registered");
  });
});
