import { env } from "./lib/env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { closeDb } from "@hvac-saas/database";
import adminAuthPlugin from "./plugins/admin-auth.js";
import adminAuthRoutes from "./routes/admin/auth.js";

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  // --- Plugins ---
  await fastify.register(cors, {
    origin: ["http://localhost:3000", env.API_BASE_URL],
    credentials: true,
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "HVAC SaaS API",
        version: "0.1.0",
        description: "HVAC Field Service Management API",
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await fastify.register(adminAuthPlugin);

  // --- Routes ---
  fastify.get(
    "/health",
    {
      schema: {
        description: "Health check",
        tags: ["System"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  );

  await fastify.register(adminAuthRoutes, { prefix: "/admin/auth" });

  return fastify;
}

async function start() {
  const server = await buildServer();

  const shutdown = async (signal: string) => {
    server.log.info(`${signal} received — shutting down`);
    await server.close();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  server.log.info(
    `Server running at http://localhost:${env.PORT}`,
  );
  server.log.info(
    `Swagger docs at http://localhost:${env.PORT}/docs`,
  );
}

start();
