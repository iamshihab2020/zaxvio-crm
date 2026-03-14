import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Get a Supabase admin client using the service role key.
 * Bypasses RLS — use for Storage + Realtime only.
 *
 * Lazy singleton — one admin client per process.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
      );
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey);
  }

  return adminClient;
}
