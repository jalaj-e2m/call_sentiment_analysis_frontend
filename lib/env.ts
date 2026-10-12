// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced literally.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const SUPABASE_CONFIGURED = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

/**
 * Fake data and no login. Needs NEXT_PUBLIC_USE_FIXTURES=true AND no Supabase env, so fixture
 * data can never appear in an app that is connected to the real project.
 */
export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "true" && !SUPABASE_CONFIGURED;
