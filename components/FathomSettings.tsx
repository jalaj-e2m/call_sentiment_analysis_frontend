"use client";

import { CircleCheck, KeyRound, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { connectFathom, disconnectFathom } from "@/lib/fathom";
import type { FathomAccount } from "@/lib/model";
import { describeSyncResult, formatDateTime, formatRelative } from "@/lib/sentiment";
import { SyncButton, syncStatusText, useSync } from "./sync";
import { Card, Notice, buttonClass, dangerButtonClass, inputClass, primaryButtonClass } from "./ui";

function ConnectForm({ replacing, onDone }: { replacing: boolean; onDone: (message: string) => void }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await connectFathom(key.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setKey("");
    router.refresh();
    onDone(replacing ? "Key replaced." : "Connected. Click Sync now to import your last 20 meetings.");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Fathom API key</span>
        <input
          type="password"
          name="fathom-api-key"
          autoComplete="off"
          spellCheck={false}
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your key"
          className={inputClass}
        />
      </label>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        In Fathom open <strong>Settings → API Access</strong> and generate a key. We test it with Fathom, then store it
        encrypted in Supabase Vault. It is never shown again, only its last 4 characters.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="submit" disabled={busy || key.trim().length === 0} className={primaryButtonClass}>
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Testing key…" : replacing ? "Test & replace" : "Test & save"}
      </button>
    </form>
  );
}

export function FathomSettings({ account }: { account: FathomAccount | null }) {
  const router = useRouter();
  const { state } = useSync();
  const [replacing, setReplacing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    if (!window.confirm("Disconnect Fathom? Your stored key is deleted. Imported calls stay.")) return;
    setDisconnecting(true);
    const result = await disconnectFathom();
    setDisconnecting(false);
    setNotice(result.ok ? { tone: "success", text: "Disconnected. Your key was deleted." } : { tone: "error", text: result.error });
    router.refresh();
  }

  const done = (text: string) => {
    setReplacing(false);
    setNotice({ tone: "success", text });
  };

  if (!account?.connected) {
    return (
      <div className="space-y-4">
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        <Card title="Connect your Fathom account" description="Each person connects their own account and syncs their own calls.">
          <ConnectForm replacing={false} onDone={done} />
        </Card>
      </div>
    );
  }

  const status = syncStatusText(state);
  const result = account.lastSyncResult;
  return (
    <div className="space-y-4">
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <Card
        title="Connection"
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CircleCheck className="h-3 w-3" aria-hidden />
            Connected
          </span>
        }
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">API key</dt>
            <dd className="mt-0.5 font-mono">••••{account.keyLast4 ?? "????"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Last sync</dt>
            <dd className="mt-0.5" title={account.lastSyncAt ? formatDateTime(account.lastSyncAt) : undefined} suppressHydrationWarning>
              {formatRelative(account.lastSyncAt, new Date())}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Status</dt>
            <dd className="mt-0.5 capitalize">{status ? "running" : account.syncStatus}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <SyncButton />
          <button type="button" className={buttonClass} onClick={() => setReplacing((v) => !v)}>
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            {replacing ? "Cancel" : "Replace key"}
          </button>
          <button type="button" className={dangerButtonClass} onClick={disconnect} disabled={disconnecting}>
            <Unplug className="h-3.5 w-3.5" aria-hidden />
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
        {replacing ? (
          <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
            <ConnectForm replacing onDone={done} />
          </div>
        ) : null}
      </Card>

      <Card title="Last sync" description="Counts only; nothing from the meetings themselves.">
        <div className="space-y-3 text-sm">
          {status ? <Notice>{status}</Notice> : null}
          {state.message && !status ? (
            <Notice tone={state.tone === "error" ? "error" : state.tone === "success" ? "success" : "info"}>{state.message}</Notice>
          ) : null}
          {account.syncStatus === "failed" && account.lastSyncError ? (
            <Notice tone="error">Last sync failed: {account.lastSyncError}</Notice>
          ) : null}
          <p className="text-zinc-700 dark:text-zinc-300">{describeSyncResult(result)}</p>
          {result?.truncated ? (
            <Notice tone="warning">
              More than 100 new meetings were waiting, so only the newest 100 were imported. Ask an admin to run the
              backfill script for the older ones.
            </Notice>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
