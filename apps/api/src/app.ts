import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { getJwtSecret } from "./config.js";
import { personaRoutes } from "./routes/personas.js";
import { authRoutes } from "./routes/auth.js";
import { cartRoutes } from "./routes/cart.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { checkoutRoutes } from "./routes/checkout.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(jwt, { secret: getJwtSecret() });

  await app.register(personaRoutes);
  await app.register(authRoutes);
  await app.register(cartRoutes);
  await app.register(favoriteRoutes);
  await app.register(checkoutRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
