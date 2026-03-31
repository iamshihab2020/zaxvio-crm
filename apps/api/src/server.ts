import { env } from "./lib/env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { closeDb } from "@hvac-saas/database";
import { auth } from "./lib/auth.js";
import tenantRoutes from "./routes/tenants/index.js";
import customerRoutes from "./routes/customers/index.js";
import tagRoutes from "./routes/tags/index.js";
import catalogRoutes from "./routes/catalog/index.js";
import jobRoutes from "./routes/jobs/index.js";
import checklistRoutes from "./routes/checklists/index.js";
import pipelineStagesRoutes from "./routes/pipeline-stages/index.js";
import invoiceRoutes from "./routes/invoices/index.js";
import quoteRoutes from "./routes/quotes/index.js";
import dashboardRoutes from "./routes/dashboard/index.js";
import availabilityRoutes from "./routes/availability/index.js";
import publicBookingRoutes from "./routes/public/booking.js";
import bookingRoutes from "./routes/bookings/index.js";
import calendarEventRoutes from "./routes/calendar-events/index.js";
import adminRoutes from "./routes/admin/index.js";

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
    origin: [env.FRONTEND_URL, env.API_BASE_URL],
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

  // --- Better Auth handler ---
  // Use auth.handler() with a reconstructed Fetch Request instead of toNodeHandler,
  // because Fastify consumes the request body before the Node handler can read it.
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`,
      );

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers.append(key, Array.isArray(value) ? value.join(", ") : value);
      }

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      const response = await auth.handler(req);

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const text = await response.text();
      return reply.send(text || null);
    },
  });

  // --- Routes ---
  await fastify.register(tenantRoutes, { prefix: "/tenants" });
  await fastify.register(customerRoutes, { prefix: "/customers" });
  await fastify.register(tagRoutes, { prefix: "/tags" });
  await fastify.register(catalogRoutes, { prefix: "/catalog" });
  await fastify.register(jobRoutes, { prefix: "/jobs" });
  await fastify.register(checklistRoutes, { prefix: "/checklists" });
  await fastify.register(pipelineStagesRoutes, { prefix: "/pipeline-stages" });
  await fastify.register(invoiceRoutes, { prefix: "/invoices" });
  await fastify.register(quoteRoutes, { prefix: "/quotes" });
  await fastify.register(dashboardRoutes, { prefix: "/dashboard" });
  await fastify.register(availabilityRoutes, { prefix: "/availability" });
  await fastify.register(publicBookingRoutes, { prefix: "/public/booking" });
  await fastify.register(bookingRoutes, { prefix: "/bookings" });
  await fastify.register(calendarEventRoutes, { prefix: "/calendar-events" });
  await fastify.register(adminRoutes, { prefix: "/admin" });

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
  // Windows: Turbo doesn't propagate SIGINT to child processes.
  // SIGHUP fires when the parent terminal/process is killed.
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  server.log.info(
    `Server running at http://localhost:${env.PORT}`,
  );
  server.log.info(
    `Swagger docs at http://localhost:${env.PORT}/docs`,
  );

  // Start email cron jobs (E-07 overdue, E-09 contract renewal, E-10 trial expiry)
  const { startEmailCronJobs } = await import("./lib/cron/email-cron.js");
  startEmailCronJobs();
}

start();
