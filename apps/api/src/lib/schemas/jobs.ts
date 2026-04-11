import { z } from "zod";
import { idParam, paginationQuery } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

export const lineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const photoParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const photoTagParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const documentParam = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
});

export const completionIdParam = z.object({
  id: z.string().uuid(),
  completionId: z.string().uuid(),
});

// ── Querystrings ──────────────────────────────────────────────────────────────

export const jobListQuery = paginationQuery.extend({
  // Kanban board loads all pipeline jobs at once — allow up to 500
  limit: z.coerce.number().int().min(1).max(500).default(20),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  customerId: z.string().uuid().optional(),
  serviceType: z.string().optional(),
  priority: z.enum(["low", "standard", "high", "urgent"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  assigneeId: z.string().optional(),
  sortBy: z
    .enum(["scheduledDate", "createdAt", "jobNumber", "status", "priority", "totalAmount"])
    .default("scheduledDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const photoListQuery = z.object({
  tag: z.enum(["before", "after", "general"]).optional(),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createJobBody = z.object({
  customerId: z.string().uuid(),
  serviceType: z.string().min(1),
  title: z.string().min(1),
  scheduledDate: z.string().min(1),
  description: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  address: z.string().optional(),
  priority: z.enum(["low", "standard", "high", "urgent"]).optional(),
  status: z.string().optional(),
  taxRate: z.string().optional(),
  notes: z.string().optional(),
  equipmentId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  assigneeId: z.string().optional().nullable(),
});

export const updateJobBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "standard", "high", "urgent"]).optional(),
  serviceType: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.string().optional(),
  equipmentId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export const updateJobStatusBody = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
});

export const reorderBody = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
      status: z.string().optional(),
    }),
  ).min(1),
});

export const addLineItemBody = z.object({
  description: z.string().optional(),
  unitPrice: z.string().optional(),
  itemType: z.enum(["labor", "material", "other"]).optional(),
  quantity: z.string().optional(),
  catalogItemId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateLineItemBody = z.object({
  description: z.string().min(1).max(500).optional(),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  itemType: z.enum(["labor", "material", "other"]).optional(),
});

export const toggleChecklistBody = z.object({
  isCompleted: z.boolean().optional(),
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

export const addDocumentBody = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  customerId: z.string().uuid().optional(),
});

export const uploadFileBody = z.object({
  data: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  tag: z.enum(["before", "after", "general"]).optional().default("general"),
});

// ── Bulk Operations ──────────────────────────────────────────────────────────

export const bulkJobStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
});
