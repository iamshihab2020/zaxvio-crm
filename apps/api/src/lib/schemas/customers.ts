import { z } from "zod";
import { idParam, paginationQuery } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

export const noteIdParam = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
});

export const tagIdParam = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
});

// ── Querystrings ──────────────────────────────────────────────────────────────

export const customerListQuery = paginationQuery.extend({
  sortBy: z.enum(["createdAt", "firstName", "lastName", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createCustomerBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCustomerBody = createCustomerBody.partial();

export const assignTagBody = z.object({
  tagId: z.string().uuid(),
});

export const createNoteBody = z.object({
  content: z.string().min(1).trim(),
});

export const updateNoteBody = z.object({
  content: z.string().min(1).trim(),
});
