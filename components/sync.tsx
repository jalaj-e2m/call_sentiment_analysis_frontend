"use client";

import { Plug, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { triggerAnalysis } from "@/lib/analyze";
import { syncFathom } from "@/lib/fathom";
import type { FathomAccount } from "@/lib/model";
import { ANALYSIS_CONCURRENCY, describeSyncResult, formatRelative, runWithConcurrency } from "@/lib/sentiment";
import { buttonClass, iconButtonClass, primaryButtonClass } from "./ui";


export interface SyncState {
  phase: "idle" | "syncing" | "analysing";
  message: string | null;
  tone: "info" | "success" | "error";
  progress: { done: number; failed: number; total: number } | null;
}

interface SyncContextValue {
  account: FathomAccount | null;
  state: SyncState;
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used inside SyncProvider");
  return value;
}

/**
 * Manual Fathom sync for the signed-in user. After the import, new client calls that are not
 * manual-only are analysed from this tab; if it closes early, the rest keep their Analyze button.
 */
export function SyncProvider({ account, children }: { account: FathomAccount | null; children: ReactNode }) {
  const router = useRouter();
  const busy = useRef(false);
  const [state, setState] = useState<SyncState>({ phase: "idle", message: null, tone: "info", progress: null });

  const sync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setState({ phase: "syncing", message: "Fetching meetings from Fathom…", tone: "info", progress: null });
      const response = await syncFathom();
      router.refresh();
      if (!response.ok) {
        setState({ phase: "idle", message: response.error, tone: "error", progress: null });
        return;
      }

      let summary = describeSyncResult(response.result);
      if (response.result.truncated) summary += " · only the newest 100 imported, see Fathom page";
      const ids = response.analyse_call_ids;
      if (ids.length === 0) {
        setState({ phase: "idle", message: summary, tone: "success", progress: null });
        return;
      }

      const progress = { done: 0, failed: 0, total: ids.length };
      setState({ phase: "analysing", message: summary, tone: "info", progress: { ...progress } });
      await runWithConcurrency(ids, ANALYSIS_CONCURRENCY, async (id) => {
        const result = await triggerAnalysis(id);
        progress.done += 1;
        if (!result.ok) progress.failed += 1;
        setState((s) => ({ ...s, progress: { ...progress } }));
        router.refresh();
      });
      const analysed = progress.done - progress.failed;
      setState({
        phase: "idle",
        message: `${summary} · ${analysed} analysed${progress.failed ? `, ${progress.failed} failed (retry from Calls)` : ""}`,
        tone: progress.failed ? "error" : "success",
        progress: null,
      });
    } finally {
      busy.current = false;
    }
  }, [router]);

  return <SyncContext.Provider value={{ account, state, sync }}>{children}</SyncContext.Provider>;
}

export function syncStatusText(state: SyncState): string | null {
  if (state.phase === "syncing") return "Syncing with Fathom…";
  if (state.phase === "analysing" && state.progress) {
    return `Analysing new calls ${state.progress.done}/${state.progress.total}`;
  }
  return null;
}

export function SyncButton({ size = "default", label = "Sync now" }: { size?: "default" | "block" | "icon"; label?: string }) {
  const { account, state, sync } = useSync();
  const running = state.phase !== "idle";
  if (size === "icon") {
    if (!account?.connected) return null;
    const text = syncStatusText(state) ?? label;
    return (
      <button type="button" onClick={sync} disabled={running} className={iconButtonClass} aria-label={text} title={text}>
        <RefreshCw className={`h-4 w-4 ${running ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={sync}
      disabled={running || !account?.connected}
      className={`${primaryButtonClass} ${size === "block" ? "w-full" : ""}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} aria-hidden />
      {running ? "Syncing…" : label}
    </button>
  );
}

/** Compact sync status for the sidebar. */
export function SyncPanel() {
  const { account, state } = useSync();

  if (!account?.connected) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Fathom not connected</p>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Connect your account to import your calls.</p>
        <Link href="/fathom" className={`${buttonClass} mt-2.5 w-full`}>
          <Plug className="h-3.5 w-3.5" aria-hidden />
          Connect Fathom
        </Link>
      </div>
    );
  }

  const status = syncStatusText(state);
  const tone = { info: "text-zinc-600 dark:text-zinc-400", success: "text-sent-happy-fg", error: "text-sent-unhappy-fg" }[
    state.tone
  ];
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
          <span
            className={`h-1.5 w-1.5 rounded-full ${account.syncStatus === "failed" ? "bg-sent-unhappy" : "bg-sent-happy"}`}
            aria-hidden
          />
          Fathom
        </span>
        <span className="text-zinc-600 dark:text-zinc-400" suppressHydrationWarning>
          {formatRelative(account.lastSyncAt, new Date())}
        </span>
      </div>
      <SyncButton size="block" />
      {status ? (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {status}
        </p>
      ) : state.message ? (
        <p className={`mt-2 line-clamp-3 text-xs ${tone}`} aria-live="polite">
          {state.message}
        </p>
      ) : account.syncStatus === "failed" ? (
        <p className="mt-2 text-xs text-sent-unhappy-fg">Last sync failed. See Fathom page.</p>
      ) : null}
    </div>
  );
}
