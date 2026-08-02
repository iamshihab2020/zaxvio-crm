import { z } from "zod";
import { booleanFlag } from "./common.js";
import { idParam, paginationQuery } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

// ── Querystrings ──────────────────────────────────────────────────────────────

export const catalogListQuery = paginationQuery.extend({
  itemType: z
    .enum(["labor", "part", "material", "service_call", "other"])
    .optional(),
  // `booleanFlag`, not `z.coerce.boolean()` — the latter is `Boolean(value)`
  // and `Boolean("false")` is true, so `?showArchived=false` returned
  // archived-only. Same defect as CUST-29, which is why the helper exists.
  showArchived: booleanFlag.optional().default(false),
  sortBy: z
    .enum(["createdAt", "name", "unitPrice", "category", "itemType"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createCatalogItemBody = z.object({
  name: z.string().min(1).trim(),
  itemType: z.enum(["labor", "part", "material", "service_call", "other"]),
  unitPrice: z.number().min(0),
  unit: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateCatalogItemBody = z.object({
  name: z.string().min(1).trim().optional(),
  itemType: z
    .enum(["labor", "part", "material", "service_call", "other"])
    .optional(),
  unitPrice: z.number().min(0).optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});
