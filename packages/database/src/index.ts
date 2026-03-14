// Drizzle client
export { getDb, closeDb } from "./client";

// Supabase admin client (for Storage + Realtime)
export { getSupabaseAdmin } from "./supabase";

// Schema (tables, enums, relations)
export * from "./schema/index";
