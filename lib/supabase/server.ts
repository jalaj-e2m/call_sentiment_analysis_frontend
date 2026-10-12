import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, USE_FIXTURES } from "../env";

export type Db = SupabaseClient<Database>;

/** Server-side client acting as the signed-in user (RLS applies), or null in fixture mode. */
export async function getDb(): Promise<Db | null> {
  await connection();
  if (USE_FIXTURES) return null;
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
