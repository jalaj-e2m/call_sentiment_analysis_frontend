import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL } from "../env";

export type Db = SupabaseClient<Database>;

/**
 * Server-side client acting as the signed-in user (RLS applies), or null without Supabase env.
 * Query helpers only turn null into fixture data when USE_FIXTURES is on.
 */
export async function getDb(): Promise<Db | null> {
  await connection();
  if (!SUPABASE_CONFIGURED) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
