import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { cartItems } from "../db.js";

const USER_A = "checkout-user-a";
const USER_B = "checkout-user-b";

function authHeader(app: FastifyInstance, userId: string) {
  const token = app.jwt.sign({ id: userId, email: `${userId}@example.com` });
  return { authorization: `Bearer ${token}` };
}

function addToCart(
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

function checkout(app: FastifyInstance, userId: string) {
  return app.inject({
    method: "POST",
    url: "/checkout",
    headers: authHeader(app, userId),
    payload: { name: "Ada Lovelace", email: "ada@example.com" },
  });
}

describe("POST /checkout clears the cart (issue #22)", () => {
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

  it("empties the buyer's cart after a 201 and rejects a repeat checkout", async () => {
    await addToCart(app, USER_A, "p-001", 2);

    const order = await checkout(app, USER_A);
    expect(order.statusCode).toBe(201);
    // The created order still snapshots the purchased items and total.
    expect(order.json().items).toHaveLength(1);
    expect(order.json().total).toBeGreaterThan(0);

    const cart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader(app, USER_A),
    });
    expect(cart.json().items).toHaveLength(0);
    expect(cart.json().total).toBe(0);

    const second = await checkout(app, USER_A);
    expect(second.statusCode).toBe(400);
    expect(second.json().error).toBe("Cart is empty");
  });

  it("leaves another user's cart untouched", async () => {
    await addToCart(app, USER_A, "p-001");
    await addToCart(app, USER_B, "p-002");

    const order = await checkout(app, USER_A);
    expect(order.statusCode).toBe(201);

    const bCart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader(app, USER_B),
    });
    expect(bCart.json().items).toHaveLength(1);
    expect(bCart.json().items[0].personaId).toBe("p-002");
  });
});
