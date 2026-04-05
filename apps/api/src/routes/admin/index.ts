import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import adminDashboardRoutes from "./dashboard.js";
import adminTenantRoutes from "./tenants.js";
import adminAnalyticsRoutes from "./analytics.js";
import adminAuditRoutes from "./audit.js";
import adminSearchRoutes from "./search.js";
import adminSystemRoutes from "./system.js";
import adminAdminsRoutes from "./admins.js";
import impersonationRoutes from "./impersonation.js";

const adminRoutes: FastifyPluginAsyncZod = async (fastify) => {
  await fastify.register(adminDashboardRoutes, { prefix: "/dashboard" });
  await fastify.register(adminTenantRoutes, { prefix: "/tenants" });
  await fastify.register(adminAnalyticsRoutes, { prefix: "/analytics" });
  await fastify.register(adminAuditRoutes);
  await fastify.register(adminSearchRoutes, { prefix: "/search" });
  await fastify.register(adminSystemRoutes, { prefix: "/system" });
  await fastify.register(adminAdminsRoutes, { prefix: "/admins" });
  await fastify.register(impersonationRoutes, { prefix: "/impersonation" });
};
export default adminRoutes;
