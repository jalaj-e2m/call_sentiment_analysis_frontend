"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { getBrowserDb } from "./supabase/browser";

export type FunctionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export const FIXTURE_MODE_ERROR = "Fixture mode: connect Supabase to use this.";

/**
 * Invoke an Edge Function as the signed-in user. The functions answer { ok: true, ... } or
 * { ok: false, error } (also as the body of non-2xx responses).
 */
export async function invokeFunction<T extends object>(name: string, body: object): Promise<FunctionResult<T>> {
  const db = getBrowserDb();
  if (!db) return { ok: false, error: FIXTURE_MODE_ERROR };

  const { data, error } = await db.functions.invoke<({ ok: boolean; error?: string } & T) | null>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: payload?.error ?? error.message };
    }
    return { ok: false, error: error.message };
  }
  if (!data?.ok) return { ok: false, error: data?.error ?? "The request failed." };
  return data as { ok: true } & T;
}
