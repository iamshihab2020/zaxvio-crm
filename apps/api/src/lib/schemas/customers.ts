import { z } from "zod";

export const assignTagBody = z.object({
  tagId: z.string().uuid(),
});

export const tagIdParam = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
});
