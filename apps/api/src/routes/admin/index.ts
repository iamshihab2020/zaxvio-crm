import type { FastifyInstance } from "fastify";
import adminDashboardRoutes from "./dashboard.js";
import adminTenantRoutes from "./tenants.js";
import adminAnalyticsRoutes from "./analytics.js";
import adminAuditRoutes from "./audit.js";
import adminSearchRoutes from "./search.js";
import adminSystemRoutes from "./system.js";

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(adminDashboardRoutes, { prefix: "/dashboard" });
  await fastify.register(adminTenantRoutes, { prefix: "/tenants" });
  await fastify.register(adminAnalyticsRoutes, { prefix: "/analytics" });
  await fastify.register(adminAuditRoutes);
  await fastify.register(adminSearchRoutes, { prefix: "/search" });
  await fastify.register(adminSystemRoutes, { prefix: "/system" });
}
