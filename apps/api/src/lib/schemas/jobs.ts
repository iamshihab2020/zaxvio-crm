import { z } from "zod";

export const updateLineItemBody = z.object({
  description: z.string().min(1).max(500).optional(),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  itemType: z.enum(["labor", "material", "other"]).optional(),
});

export const lineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const photoParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const addPhotoBody = z.object({
  storagePath: z.string().min(1).max(500),
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
});
