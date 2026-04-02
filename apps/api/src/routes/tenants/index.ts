import type { FastifyInstance } from "fastify";
import { requireAuth, requireTenant, requireOrgRole } from "../../lib/auth-middleware.js";
import {
  getDb,
  getSupabaseAdmin,
  tenants,
  tenantSubscriptions,
  pipelines,
  jobPipelineStages,
  availabilitySchedules,
  user,
  organization,
  eq,
} from "@hvac-saas/database";
import tenantImpersonationRoutes from "./impersonation.js";

export default async function tenantRoutes(fastify: FastifyInstance) {
  // Sub-routes
  await fastify.register(tenantImpersonationRoutes, { prefix: "/impersonation" });
  /**
   * GET /tenants/current
   *
   * Return the current tenant's data.
   */
  fastify.get(
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
  fastify.patch(
    "/current",
    { preHandler: [requireOrgRole(["owner", "admin"])] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;

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
      ] as const;

      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No valid fields to update" });
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
   * Upload a business logo. Accepts multipart form with a single "logo" file.
   * Stores in Supabase Storage "logos" bucket. Updates tenant.logoUrl.
   * Max 2MB, image/* only.
   */
  fastify.post(
    "/current/logo",
    { preHandler: [requireOrgRole(["owner", "admin"])] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;

      // Parse multipart — Fastify needs @fastify/multipart or raw body
      const contentType = request.headers["content-type"] ?? "";
      if (!contentType.includes("application/json")) {
        return reply.status(400).send({ message: "Expected JSON body with base64 image data" });
      }

      const body = request.body as {
        data: string; // base64 encoded image
        filename: string;
        mimeType: string;
      };

      if (!body.data || !body.filename || !body.mimeType) {
        return reply.status(400).send({ message: "data, filename, and mimeType are required" });
      }

      if (!body.mimeType.startsWith("image/")) {
        return reply.status(400).send({ message: "Only image files are allowed" });
      }

      const buffer = Buffer.from(body.data, "base64");

      // 2MB limit
      if (buffer.length > 2 * 1024 * 1024) {
        return reply.status(400).send({ message: "Logo must be under 2MB" });
      }

      const ext = body.filename.split(".").pop() ?? "png";
      const storagePath = `${tenantId}/logo.${ext}`;
      const supabase = getSupabaseAdmin();

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(storagePath, buffer, {
          contentType: body.mimeType,
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
  fastify.delete(
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
  fastify.post(
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

      // Check if tenant already exists (idempotent)
      const existing = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.organizationId, activeOrganizationId))
        .then((r) => r[0]);

      if (existing) {
        return reply
          .status(200)
          .send({ message: "Tenant already exists", tenantId: existing.id });
      }

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

      const [tenant] = await db
        .insert(tenants)
        .values({
          organizationId: org.id,
          businessName: org.name,
          ownerName: creator?.name ?? "Owner",
          email: creator?.email ?? "",
          slug: org.slug ?? org.id,
          trialEndsAt,
        })
        .returning();

      await db.insert(tenantSubscriptions).values({
        tenantId: tenant.id,
        status: "trialing",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
      });

      // Seed default pipeline and stages
      const [defaultPipeline] = await db.insert(pipelines).values({
        tenantId: tenant.id,
        name: "default",
        label: "Default",
        isDefault: true,
      }).returning();

      await db.insert(jobPipelineStages).values([
        { tenantId: tenant.id, pipelineId: defaultPipeline.id, name: "scheduled", label: "Scheduled", color: "blue", sortOrder: 0, isDefault: true },
        { tenantId: tenant.id, pipelineId: defaultPipeline.id, name: "in_progress", label: "In Progress", color: "brand", sortOrder: 1, isDefault: true },
        { tenantId: tenant.id, pipelineId: defaultPipeline.id, name: "completed", label: "Completed", color: "green", sortOrder: 2, isDefault: true },
        { tenantId: tenant.id, pipelineId: defaultPipeline.id, name: "cancelled", label: "Cancelled", color: "gray", sortOrder: 3, isDefault: true },
      ]);

      // Seed default availability schedule (Mon-Fri 8am-5pm)
      await db.insert(availabilitySchedules).values(
        [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          tenantId: tenant.id,
          dayOfWeek: day,
          startTime: "08:00",
          endTime: "17:00",
          isActive: day >= 1 && day <= 5, // Mon-Fri active, Sat-Sun inactive
        })),
      );

      return reply
        .status(201)
        .send({ message: "Tenant created", tenantId: tenant.id });
    },
  );
}
