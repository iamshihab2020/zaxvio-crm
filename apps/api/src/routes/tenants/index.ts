import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth, requireTenant, requireOrgRole } from "../../lib/auth-middleware.js";
import {
  getDb,
  getSupabaseAdmin,
  tenants,
  tenantSubscriptions,
  availabilitySchedules,
  user,
  organization,
  eq,
} from "@hvac-saas/database";
import tenantImpersonationRoutes from "./impersonation.js";
import {
  updateTenantBody,
  uploadLogoBody,
  ALLOWED_EXTENSIONS,
} from "../../lib/schemas/tenants.js";
import {
  getOrCreateDefaultPipeline,
  ensureDefaultStages,
} from "../pipeline-stages/index.js";
import { stripHtmlTags } from "../../lib/sanitize.js";

const tenantRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // Sub-routes
  await fastify.register(tenantImpersonationRoutes, { prefix: "/impersonation" });
  /**
   * GET /tenants/current
   *
   * Return the current tenant's data.
   */
  f.get(
    "/current",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const db = getDb();
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, request.authUser.tenantId!))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      return reply.send({ data: tenant });
    },
  );

  /**
   * PATCH /tenants/current
   *
   * Update the current tenant's fields.
   */
  f.patch(
    "/current",
    {
      preHandler: [requireOrgRole(["owner", "admin"])],
      schema: { body: updateTenantBody },
    },
    async (request, reply) => {
      const body = request.body;

      const allowedFields = [
        "businessName",
        "ownerName",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zipCode",
        "defaultTaxRate",
        "googleReviewUrl",
        "logoUrl",
        "timezone",
        "licenseNumber",
        "invoicePaymentTerms",
        "invoicePaymentInstructions",
        "invoiceTermsConditions",
        "invoiceFooterMessage",
        "quoteTermsConditions",
        "quoteFooterMessage",
        "quoteOnlineAcceptanceEnabled",
        "quotePostAcceptanceScheduling",
        "quoteAutoConvertToJob",
      ] as const;

      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field as keyof typeof body];
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No valid fields to update" });
      }

      // Sanitize text fields that render in emails/PDFs
      const SANITIZE_FIELDS = [
        "businessName", "ownerName", "address", "city", "state",
        "invoicePaymentTerms", "invoicePaymentInstructions",
        "invoiceTermsConditions", "invoiceFooterMessage",
        "quoteTermsConditions", "quoteFooterMessage", "licenseNumber",
      ];
      for (const field of SANITIZE_FIELDS) {
        if (typeof updates[field] === "string") {
          updates[field] = stripHtmlTags(updates[field] as string);
        }
      }

      // DB stores defaultTaxRate as text
      if (updates.defaultTaxRate !== undefined) {
        updates.defaultTaxRate = String(updates.defaultTaxRate);
      }

      updates.updatedAt = new Date();

      const db = getDb();
      const [updated] = await db
        .update(tenants)
        .set(updates)
        .where(eq(tenants.id, request.authUser.tenantId!))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /tenants/current/logo
   *
   * Upload a business logo. Accepts JSON body with base64-encoded image.
   * Stores in Supabase Storage "logos" bucket. Updates tenant.logoUrl.
   * Max 2MB, image/* only.
   */
  f.post(
    "/current/logo",
    {
      preHandler: [requireOrgRole(["owner", "admin"])],
      schema: { body: uploadLogoBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;

      // Parse multipart — Fastify needs @fastify/multipart or raw body
      const contentType = request.headers["content-type"] ?? "";
      if (!contentType.includes("application/json")) {
        return reply.status(400).send({ message: "Expected JSON body with base64 image data" });
      }

      const { data, filename, mimeType } = request.body;

      const buffer = Buffer.from(data, "base64");

      // 2MB limit
      if (buffer.length > 2 * 1024 * 1024) {
        return reply.status(400).send({ message: "Logo must be under 2MB" });
      }

      const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return reply.status(400).send({ message: "Invalid file extension" });
      }
      const storagePath = `${tenantId}/logo.${ext}`;
      const supabase = getSupabaseAdmin();

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("[logo-upload] Storage error:", uploadError);
        return reply.status(500).send({ message: "Failed to upload logo" });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(storagePath);

      const logoUrl = urlData.publicUrl;

      // Update tenant
      const db = getDb();
      const [updated] = await db
        .update(tenants)
        .set({ logoUrl, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /tenants/current/logo
   *
   * Remove the business logo.
   */
  f.delete(
    "/current/logo",
    { preHandler: [requireOrgRole(["owner", "admin"])] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Get current logo URL to extract storage path
      const tenant = await db
        .select({ logoUrl: tenants.logoUrl })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      if (tenant?.logoUrl) {
        // Try to remove from storage (best-effort)
        const supabase = getSupabaseAdmin();
        const pathMatch = tenant.logoUrl.match(/logos\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from("logos").remove([pathMatch[1]]).catch(() => {});
        }
      }

      const [updated] = await db
        .update(tenants)
        .set({ logoUrl: null, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /tenants/initialize
   *
   * Idempotent endpoint to create a tenant + subscription for the
   * caller's active organization. Handles the edge case of orgs
   * created before the databaseHook was added.
   */
  f.post(
    "/initialize",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { activeOrganizationId, userId } = request.authUser;

      if (!activeOrganizationId) {
        return reply
          .status(400)
          .send({ message: "No active organization in session" });
      }

      const db = getDb();

      // Fetch org + user details
      const [org, creator] = await Promise.all([
        db
          .select()
          .from(organization)
          .where(eq(organization.id, activeOrganizationId))
          .then((r) => r[0]),
        db
          .select()
          .from(user)
          .where(eq(user.id, userId))
          .then((r) => r[0]),
      ]);

      if (!org) {
        return reply.status(404).send({ message: "Organization not found" });
      }

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Step 1: Insert tenant with conflict guard (idempotent)
      await db
        .insert(tenants)
        .values({
          organizationId: org.id,
          businessName: org.name,
          ownerName: creator?.name ?? "Owner",
          email: creator?.email ?? "",
          slug: org.slug ?? org.id,
          trialEndsAt,
        })
        .onConflictDoNothing();

      // Step 2: Always fetch the tenant (whether just created or already existed)
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.organizationId, activeOrganizationId))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(500).send({ message: "Failed to resolve tenant" });
      }

      // Step 3: Idempotent child resource seeding — each insert is independently safe to retry

      // Subscription
      await db
        .insert(tenantSubscriptions)
        .values({
          tenantId: tenant.id,
          status: "trialing",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
        })
        .onConflictDoNothing();

      // Pipeline + stages (already idempotent via getOrCreateDefaultPipeline/ensureDefaultStages)
      const defaultPipeline = await getOrCreateDefaultPipeline(db, tenant.id);
      await ensureDefaultStages(db, tenant.id, defaultPipeline.id);

      // Availability schedules (unique index on tenantId + dayOfWeek)
      await db
        .insert(availabilitySchedules)
        .values(
          [0, 1, 2, 3, 4, 5, 6].map((day) => ({
            tenantId: tenant.id,
            dayOfWeek: day,
            startTime: "08:00",
            endTime: "17:00",
            isActive: day >= 1 && day <= 5,
          })),
        )
        .onConflictDoNothing();

      return reply
        .status(200)
        .send({ message: "Tenant initialized", tenantId: tenant.id });
    },
  );
};
export default tenantRoutes;
