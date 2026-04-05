import { z } from "zod";
import { idParam, paginationQuery } from "./common.js";

export { idParam };

export const quoteLineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const quoteListQuery = paginationQuery.extend({
  status: z
    .enum(["draft", "sent", "accepted", "declined", "expired"])
    .optional(),
  customerId: z.string().uuid().optional(),
  sortBy: z
    .enum(["createdAt", "issuedDate", "expiryDate", "quoteNumber", "status", "totalAmount"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createQuoteBody = z.object({
  customerId: z.string().uuid(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  taxRate: z.string().optional(),
  discountAmount: z.string().optional(),
  notes: z.string().optional(),
  equipmentId: z.string().uuid().optional(),
});

export const updateQuoteBody = z.object({
  customerId: z.string().uuid().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  taxRate: z.string().optional(),
  discountAmount: z.string().optional(),
  notes: z.string().optional(),
  equipmentId: z.string().uuid().optional(),
});

export const addLineItemBody = z.object({
  catalogItemId: z.string().uuid().optional(),
  itemType: z.string().optional(),
  description: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateLineItemBody = z.object({
  catalogItemId: z.string().uuid().optional(),
  itemType: z.string().optional(),
  description: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const convertBody = z.object({
  pipelineStageId: z.string().uuid().optional(),
});

export const activitiesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
