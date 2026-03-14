// Drizzle client
export { getDb, closeDb } from "./client";

// Supabase clients (for auth + realtime)
export { getSupabaseClient, getSupabaseAdmin } from "./supabase";

// Schema (tables, enums, relations)
export * from "./schema/index";
