"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL } from "../env";

let client: SupabaseClient<Database> | null = null;

/** Browser client for auth and Edge Function calls, or null in fixture mode / without Supabase env. */
export function getBrowserDb(): SupabaseClient<Database> | null {
  if (!SUPABASE_CONFIGURED) return null;
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
