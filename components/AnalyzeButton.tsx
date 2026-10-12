"use client";

import { RotateCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { triggerAnalysis } from "@/lib/analyze";
import { buttonClass, smallButtonClass } from "./ui";

/**
 * Analyze / Retry. Calls onStart immediately so the row can show "queued" optimistically; the
 * page polls while the call is running and refreshes when the function returns.
 */
export function AnalyzeButton({
  callId,
  retry = false,
  size = "default",
  onStart,
  onDone,
}: {
  callId: string;
  retry?: boolean;
  size?: "default" | "small";
  onStart?: () => void;
  onDone?: (error: string | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    onStart?.();
    router.refresh();
    const result = await triggerAnalysis(callId);
    setBusy(false);
    const message = result.ok ? null : result.error;
    setError(message);
    onDone?.(message);
    router.refresh();
  }

  const Icon = retry ? RotateCw : Sparkles;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={size === "small" ? smallButtonClass : buttonClass} onClick={run} disabled={busy}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Starting…" : retry ? "Retry" : "Analyze"}
      </button>
      {error ? <span className="max-w-56 text-xs text-red-700 dark:text-red-300">{error}</span> : null}
    </span>
  );
}
