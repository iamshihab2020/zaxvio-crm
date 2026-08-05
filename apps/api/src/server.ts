import { env } from "./lib/env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { closeDb } from "@hvac-saas/database";
import { auth } from "./lib/auth.js";
import { healthResponse } from "./lib/schemas/common.js";
import {
  printStartupBanner,
  printShutdownMessage,
  printCronStarted,
} from "./lib/startup-logger.js";
import tenantRoutes from "./routes/tenants/index.js";
import customerRoutes from "./routes/customers/index.js";
import tagRoutes from "./routes/tags/index.js";
import catalogRoutes from "./routes/catalog/index.js";
import jobRoutes from "./routes/jobs/index.js";
import checklistRoutes from "./routes/checklists/index.js";
import pipelineRoutes from "./routes/pipelines/index.js";
import pipelineStagesRoutes from "./routes/pipeline-stages/index.js";
import invoiceRoutes from "./routes/invoices/index.js";
import quoteRoutes from "./routes/quotes/index.js";
import dashboardRoutes from "./routes/dashboard/index.js";
import availabilityRoutes from "./routes/availability/index.js";
import publicBookingRoutes from "./routes/public/booking.js";
import publicQuoteRoutes from "./routes/public/quote.js";
import bookingRoutes from "./routes/bookings/index.js";
import calendarEventRoutes from "./routes/calendar-events/index.js";
import equipmentRoutes from "./routes/equipment/index.js";
import maintenanceContractRoutes from "./routes/maintenance-contracts/index.js";
import adminRoutes from "./routes/admin/index.js";
import notificationRoutes from "./routes/notifications/index.js";
import reportRoutes from "./routes/reports/index.js";
import conversationRoutes from "./routes/conversations/index.js";
import eventRoutes from "./routes/events/index.js";
import { analyticsCache } from "./services/analytics/cache.js";
import { MB } from "./lib/upload-limits.js";

export async function buildServer() {
  const isDev = process.env.NODE_ENV !== "production";

  const fastify = Fastify({
    // Stated rather than inherited. Fastify defaults to 1 MB, which is right
    // for the ~200 JSON endpoints here; the handful that accept a base64 file
    // raise it per-route via `bodyLimitFor()` (see lib/upload-limits.ts).
    // Raising it globally would hand every endpoint a much larger DoS surface
    // to buy nothing.
    bodyLimit: MB,
    logger: {
      level: isDev ? "debug" : "info",
      transport: isDev
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:HH:MM:ss",
              ignore: "pid,hostname,emoji",
              messageFormat: "{emoji} {msg}",
              customColors:
                "fatal:bgRed,error:red,warn:yellow,info:cyan,debug:gray,trace:gray",
              levelFirst: true,
            },
          }
        : undefined,
      formatters: {
        level(label: string) {
          const emojis: Record<string, string> = {
            trace: "🔬",
            debug: "🐛",
            info: "✅",
            warn: "⚠️ ",
            error: "❌",
            fatal: "💀",
          };
          return { level: label, emoji: emojis[label] ?? "📝" };
        },
      },
    },
  });

  // --- Zod validation ---
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // --- Plugins ---
  await fastify.register(cors, {
    origin: [env.FRONTEND_URL, env.API_BASE_URL],
    credentials: true,
  });

  // Global rate limit per IP.
  // Prod: 100/min (authenticated API default).
  // Dev: effectively unlimited to avoid blocking HMR / multi-tab refetches.
  //
  // Key generation: the public booking portal reaches this API through Next.js
  // server actions, so `req.ip` is the *Next server's* address for every
  // visitor — the portal, the dashboard and every authenticated user shared one
  // bucket (BOOK-02). When INTERNAL_PROXY_SECRET is configured, the Next server
  // proves itself and forwards the real client IP, which we key on instead.
  //
  // The secret is what makes this safe: an unauthenticated `x-forwarded-for`
  // would let anyone mint a fresh bucket per request and bypass the limit
  // entirely.
  await fastify.register(rateLimit, {
    max: isDev ? 100_000 : 100,
    timeWindow: "1 minute",
    keyGenerator: (req) => {
      const secret = env.INTERNAL_PROXY_SECRET;
      if (secret && req.headers["x-internal-proxy-secret"] === secret) {
        const forwarded = req.headers["x-client-ip"];
        const clientIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        if (clientIp) return `fwd:${clientIp}`;
      }
      return req.ip;
    },
  });

  // API docs (disabled in production)
  if (process.env.NODE_ENV !== "production") {
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
  }

  // --- Better Auth handler ---
  // Use auth.handler() with a reconstructed Fetch Request instead of toNodeHandler,
  // because Fastify consumes the request body before the Node handler can read it.
  //
  // Rate limits (per IP, 1-minute window):
  //   - Strict mutations (sign-in/sign-up/forgot-password/reset-password): 10/min prod, unlimited dev.
  //     Tight cap prevents credential brute force and mass account creation.
  //   - Other auth calls (get-session, organization reads, sign-out): 120/min prod, unlimited dev.
  //     These fire on every page load; capping them low breaks UX.
  const STRICT_AUTH_PREFIXES = [
    "/api/auth/sign-in",
    "/api/auth/sign-up",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ];
  const isStrictAuthPath = (url: string) =>
    STRICT_AUTH_PREFIXES.some((p) => url.startsWith(p));

  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: {
      rateLimit: {
        max: (req) => {
          if (isDev) return 100_000;
          return isStrictAuthPath(req.url) ? 10 : 120;
        },
        timeWindow: "1 minute",
      },
    },
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`,
      );

      // Better Auth's admin plugin mounts its own endpoints under
      // /api/auth/admin/* — set-role, create-user, impersonate-user, ban-user,
      // set-password, remove-user. Their only authorization check is
      // `role === "admin"` against the plugin's default access-control table.
      //
      // That is not the platform's model. We gate admin work on `adminTier`
      // (super_admin | support | billing_admin), and routes/admin/admins.ts sets
      // `role: "admin"` for *every* tier — the tier lives in a separate column
      // the plugin has never heard of. So a billing_admin, who is explicitly
      // barred from /admin/impersonation/start, could POST
      // /api/auth/admin/impersonate-user and receive a full session as any
      // tenant user: no reason recorded, no tenants.isActive check, no row in
      // admin_audit_log. Same story for set-role, which mints platform admins
      // around the owner-only super_admin gate in /admin/admins.
      //
      // The plugin stays registered — it owns the role/banned/impersonatedBy
      // columns and the session shape. Only its HTTP surface closes. Every
      // admin action the product actually performs goes through /admin/*, which
      // is tier-gated and audited. Nothing calls these: adminClient() is
      // registered in apps/web/src/lib/auth-client.ts but has zero call sites.
      //
      // A denylist has to normalize at least as aggressively as the router it
      // guards, or the guard is decorative. Dot segments are already resolved by
      // `new URL` above, and the same normalized url is what auth.handler gets
      // below. That leaves case and percent-encoding: we test the lowercased
      // path both raw and decoded, so `/API/AUTH/ADMIN/...` and
      // `/api/auth/%61dmin/...` are refused whether or not better-auth's router
      // would have decoded them. decodeURIComponent throws on a malformed
      // sequence like `%zz`, which is itself not a path we want to forward.
      const isNativeAdminPath = (p: string) =>
        p === "/api/auth/admin" || p.startsWith("/api/auth/admin/");

      const rawPath = url.pathname.toLowerCase();
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(rawPath);
      } catch {
        return reply.status(400).send({ error: "Bad Request" });
      }

      if (isNativeAdminPath(rawPath) || isNativeAdminPath(decodedPath)) {
        return reply.status(404).send({ error: "Not Found" });
      }

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

  // Any successful write invalidates that tenant's cached analytics, so a new job or
  // a recorded payment shows up on the dashboard immediately instead of after the
  // 30s TTL. Registered once here rather than in ~30 individual handlers, so it
  // cannot drift as routes are added.
  const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
  fastify.addHook("onResponse", async (request, reply) => {
    const tenantId = request.authUser?.tenantId;
    if (!tenantId) return;
    if (!MUTATING_METHODS.has(request.method)) return;
    if (reply.statusCode >= 400) return;
    analyticsCache.invalidateTenant(tenantId);
  });

  // --- Routes ---
  await fastify.register(tenantRoutes, { prefix: "/tenants" });
  await fastify.register(customerRoutes, { prefix: "/customers" });
  await fastify.register(tagRoutes, { prefix: "/tags" });
  await fastify.register(catalogRoutes, { prefix: "/catalog" });
  await fastify.register(jobRoutes, { prefix: "/jobs" });
  await fastify.register(checklistRoutes, { prefix: "/checklists" });
  await fastify.register(pipelineRoutes, { prefix: "/pipelines" });
  await fastify.register(pipelineStagesRoutes, { prefix: "/pipeline-stages" });
  await fastify.register(invoiceRoutes, { prefix: "/invoices" });
  await fastify.register(quoteRoutes, { prefix: "/quotes" });
  await fastify.register(dashboardRoutes, { prefix: "/dashboard" });
  await fastify.register(availabilityRoutes, { prefix: "/availability" });
  await fastify.register(publicBookingRoutes, { prefix: "/public/booking" });
  await fastify.register(publicQuoteRoutes, { prefix: "/public/quote" });
  await fastify.register(bookingRoutes, { prefix: "/bookings" });
  await fastify.register(calendarEventRoutes, { prefix: "/calendar-events" });
  await fastify.register(equipmentRoutes, { prefix: "/equipment" });
  await fastify.register(maintenanceContractRoutes, { prefix: "/maintenance-contracts" });
  await fastify.register(adminRoutes, { prefix: "/admin" });
  await fastify.register(notificationRoutes, { prefix: "/notifications" });
  await fastify.register(reportRoutes, { prefix: "/reports" });
  await fastify.register(conversationRoutes, { prefix: "/conversations" });
  await fastify.register(eventRoutes, { prefix: "/events" });

  fastify.get(
    "/health",
    {
      schema: {
        description: "Health check",
        tags: ["System"],
        // Must be a Zod schema — the server registers fastify-type-provider-zod's
        // serializerCompiler, which rejects raw JSON Schema with FST_ERR_INVALID_SCHEMA.
        response: {
          200: healthResponse,
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
  const startTime = process.hrtime.bigint();
  const server = await buildServer();

  const shutdown = async (signal: string) => {
    printShutdownMessage(signal);
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

  printStartupBanner(startTime);

  // Start email cron jobs (E-07 overdue, E-09 contract renewal, E-10 trial expiry)
  const { startEmailCronJobs } = await import("./lib/cron/email-cron.js");
  startEmailCronJobs();
  printCronStarted(["E-07 Invoice Overdue", "E-09 Renewal", "E-10 Trial Expiry"]);
}

start();
