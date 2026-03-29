// Drizzle client
export { getDb, closeDb } from "./client";

// Supabase admin client (for Storage + Realtime)
export { getSupabaseAdmin } from "./supabase";

// Schema (tables, enums, relations)
export * from "./schema/index";

// Re-export drizzle-orm operators so consumers use the same instance
export { eq, and, or, ne, not, gt, gte, lt, lte, inArray, sql, ilike, desc, asc, count, countDistinct } from "drizzle-orm";
