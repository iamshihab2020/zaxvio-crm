import { z } from "zod";

/**
 * Optional target tenant for the SSE stream. Admin-only — the superadmin
 * impersonation dialog listens on the tenant it is requesting access to.
 * Everyone else is scoped to their own tenant and must omit this.
 */
export const eventStreamQuery = z.object({
  tenantId: z.string().uuid().optional(),
});
