// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced literally.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Fake data and no login: forced with NEXT_PUBLIC_USE_FIXTURES=true, automatic without Supabase env. */
export const USE_FIXTURES =
  process.env.NEXT_PUBLIC_USE_FIXTURES === "true" || SUPABASE_URL === "" || SUPABASE_ANON_KEY === "";
