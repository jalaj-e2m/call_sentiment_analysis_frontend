"use client";

import { invokeFunction } from "./functions";

export type TriggerResult = { ok: true; analysisId: string } | { ok: false; error: string };

/** Runs the analyze-call Edge Function for one call (Analyze and Retry buttons, and after a sync). */
export async function triggerAnalysis(callId: string): Promise<TriggerResult> {
  const result = await invokeFunction<{ analysis_id: string }>("analyze-call", { call_id: callId });
  return result.ok ? { ok: true, analysisId: result.analysis_id } : result;
}
