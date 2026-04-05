import { z } from "zod";
import { idParam } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

export const checklistItemParams = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

// ── Querystrings ──────────────────────────────────────────────────────────────

export const checklistListQuery = z.object({
  serviceType: z
    .enum([
      "installation",
      "repair",
      "maintenance",
      "inspection",
      "emergency",
      "consultation",
      "other",
    ])
    .optional(),
  showInactive: z
    .string()
    .transform((v) => v === "true")
    .optional()
    .default(false),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

const checklistItemInput = z.object({
  label: z.string().min(1).trim(),
  isRequired: z.boolean().optional().default(true),
  catalogItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createChecklistTemplateBody = z.object({
  name: z.string().min(1).trim(),
  serviceType: z.enum([
    "installation",
    "repair",
    "maintenance",
    "inspection",
    "emergency",
    "consultation",
    "other",
  ]),
  isActive: z.boolean().optional().default(true),
  items: z.array(checklistItemInput).optional().default([]),
});

export const updateChecklistTemplateBody = z.object({
  name: z.string().min(1).trim().optional(),
  serviceType: z
    .enum([
      "installation",
      "repair",
      "maintenance",
      "inspection",
      "emergency",
      "consultation",
      "other",
    ])
    .optional(),
  isActive: z.boolean().optional(),
});

export const addChecklistItemBody = z.object({
  label: z.string().min(1).trim(),
  isRequired: z.boolean().optional().default(true),
  catalogItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateChecklistItemBody = z.object({
  label: z.string().min(1).trim().optional(),
  isRequired: z.boolean().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
