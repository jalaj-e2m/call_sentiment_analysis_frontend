"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { getBrowserDb } from "./supabase/browser";

export type TriggerResult = { ok: true; analysisId: string } | { ok: false; error: string };

/** Runs the analyze-call Edge Function for one call (Analyze and Retry buttons). */
export async function triggerAnalysis(callId: string): Promise<TriggerResult> {
  const db = getBrowserDb();
  if (!db) return { ok: false, error: "Fixture mode: connect Supabase to run analyses." };

  const { data, error } = await db.functions.invoke<{ ok: boolean; analysis_id?: string; error?: string }>("analyze-call", {
    body: { call_id: callId },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? error.message };
    }
    return { ok: false, error: error.message };
  }
  if (!data?.ok || !data.analysis_id) return { ok: false, error: data?.error ?? "Analysis failed." };
  return { ok: true, analysisId: data.analysis_id };
}
