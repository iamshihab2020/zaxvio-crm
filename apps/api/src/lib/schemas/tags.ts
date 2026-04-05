import { z } from "zod";

export const idParam = z.object({
  id: z.string().uuid(),
});

export const createTagBody = z.object({
  name: z.string().min(1).trim(),
  color: z.string().optional(),
});

export const updateTagBody = z.object({
  name: z.string().min(1).trim().optional(),
  color: z.string().optional(),
});
