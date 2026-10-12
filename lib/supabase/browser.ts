"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, USE_FIXTURES } from "../env";

let client: SupabaseClient<Database> | null = null;

/** Browser client for auth and Edge Function calls, or null in fixture mode. */
export function getBrowserDb(): SupabaseClient<Database> | null {
  if (USE_FIXTURES) return null;
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
