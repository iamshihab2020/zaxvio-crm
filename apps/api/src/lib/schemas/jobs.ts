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
  tag: z.enum(["before", "after", "general"]).optional().default("general"),
  fileSize: z.number().int().positive().optional(),
  takenAt: z.string().datetime().optional(),
});

export const updatePhotoTagBody = z.object({
  tag: z.enum(["before", "after", "general"]),
});

export const photoTagParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const addDocumentBody = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  customerId: z.string().uuid().optional(),
});

export const documentParam = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
});

export const uploadFileBody = z.object({
  data: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  tag: z.enum(["before", "after", "general"]).optional().default("general"),
});
