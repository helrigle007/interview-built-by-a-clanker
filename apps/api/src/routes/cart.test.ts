import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { cartItems } from "../db.js";

// The cart routes read request.user.id, which @fastify/jwt only populates after
// a successful jwtVerify(). authenticate() is a no-op unless ENFORCE_AUTH=true,
// which test/setup.ts sets before any module loads, so the JWT preHandler runs
// and we exercise the real per-user ownership behavior.

const USER_A = "user-a";
const USER_B = "user-b";

function authHeader(app: FastifyInstance, userId: string) {
  const token = app.jwt.sign({ id: userId, email: `${userId}@example.com` });
  return { authorization: `Bearer ${token}` };
}

async function addToCart(
  app: FastifyInstance,
  userId: string,
  personaId: string,
  quantity = 1
) {
  return app.inject({
    method: "POST",
    url: "/cart",
    headers: authHeader(app, userId),
    payload: { personaId, quantity },
  });
}

describe("DELETE /cart/:itemId ownership (issue #21)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    cartItems.clear();
  });

  it("returns 404 and leaves the item when a different user tries to delete it", async () => {
    // User A owns a cart item.
    const added = await addToCart(app, USER_A, "p-001");
    expect(added.statusCode).toBe(200);
    const aItemId = added.json().items[0].id;

    // User B attempts to delete it.
    const del = await app.inject({
      method: "DELETE",
      url: `/cart/${aItemId}`,
      headers: authHeader(app, USER_B),
    });
    expect(del.statusCode).toBe(404);
    expect(del.json().error).toBe("Cart item not found");

    // The item is still in user A's cart.
    const aCart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader(app, USER_A),
    });
    expect(aCart.json().items).toHaveLength(1);
    expect(aCart.json().items[0].id).toBe(aItemId);
  });

  it("deletes the caller's own cart item", async () => {
    const added = await addToCart(app, USER_A, "p-002");
    const aItemId = added.json().items[0].id;

    const del = await app.inject({
      method: "DELETE",
      url: `/cart/${aItemId}`,
      headers: authHeader(app, USER_A),
    });
    expect(del.statusCode).toBe(200);

    const aCart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader(app, USER_A),
    });
    expect(aCart.json().items).toHaveLength(0);
  });

  it("returns 404 for a nonexistent cart item id", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: "/cart/cart-does-not-exist",
      headers: authHeader(app, USER_A),
    });
    expect(del.statusCode).toBe(404);
    expect(del.json().error).toBe("Cart item not found");
  });
});

describe("CORS preflight allows DELETE (issue #20)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("permits a DELETE preflight from the web origin on a cart-item URL", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/cart/some-id",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "DELETE",
      },
    });

    const allow = res.headers["access-control-allow-methods"];
    expect(allow).toBeDefined();
    expect(String(allow)).toContain("DELETE");
  });
});
