import { z } from "zod";

/** Shared body for bulk operations that only need an array of IDs */
export const bulkIdsBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

/** Body for bulk toggle active (catalog, service agreements) */
export const bulkToggleActiveBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  isActive: z.boolean(),
});

/** Body for bulk status update — entity-specific schemas override the status enum */
export const bulkStatusUpdateBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.string().min(1),
});
