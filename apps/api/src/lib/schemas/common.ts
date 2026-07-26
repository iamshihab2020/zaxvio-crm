import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  showArchived: z.coerce.boolean().default(false).optional(),
});

export const idParam = z.object({
  id: z.string().uuid(),
});

export const healthResponse = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
});
