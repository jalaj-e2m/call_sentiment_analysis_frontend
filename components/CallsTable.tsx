"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { AnalysisStatus, CallRow, ClientRow, SentimentLabel } from "@/lib/model";
import { canAnalyze, canRetry, formatDate, formatDuration, isInProgress } from "@/lib/sentiment";
import { AnalyzeButton } from "./AnalyzeButton";
import { AutoRefresh } from "./AutoRefresh";
import { SentimentBadge, StatusPill } from "./sentiment";
import { EmptyState, TableWrap, linkClass, rowClass, selectClass, surfaceClass, td, th } from "./ui";

export function CallsTable({ calls, clients }: { calls: CallRow[]; clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("");
  const [label, setLabel] = useState<"" | SentimentLabel | "none">("");
  const [status, setStatus] = useState<"" | AnalysisStatus>("");
  const [manualOnly, setManualOnly] = useState(false);
  // Optimistic "queued" until the server reports a different status than when the button was clicked.
  const [pending, setPending] = useState<Record<string, AnalysisStatus>>({});

  const effectiveStatus = (c: CallRow): AnalysisStatus => (pending[c.id] === c.status ? "queued" : c.status);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter(
      (c) =>
        (!q || `${c.title ?? ""} ${c.clientName}`.toLowerCase().includes(q)) &&
        (!client || c.clientId === client) &&
        (!label || (label === "none" ? !c.analysis : c.analysis?.label === label)) &&
        (!status || c.status === status) &&
        (!manualOnly || c.requiresManual),
    );
  }, [calls, query, client, label, status, manualOnly]);

  const polling = calls.some((c) => isInProgress(c.status) || pending[c.id] === c.status);

  return (
    <section className={surfaceClass}>
      <AutoRefresh active={polling} />
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3 text-sm dark:border-zinc-800">
        <label className="relative">
          <span className="sr-only">Search calls</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or client"
            className={`${selectClass} w-56 pl-8`}
          />
        </label>
        <select aria-label="Client" className={selectClass} value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Label" className={selectClass} value={label} onChange={(e) => setLabel(e.target.value as typeof label)}>
          <option value="">All labels</option>
          <option value="happy">Happy</option>
          <option value="neutral">Neutral</option>
          <option value="unhappy">Unhappy</option>
          <option value="none">Not analysed</option>
        </select>
        <select aria-label="Status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="done">Done</option>
          <option value="failed">Failed</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-indigo-600"
            checked={manualOnly}
            onChange={(e) => setManualOnly(e.target.checked)}
          />
          Manual only
        </label>
        <span className="ml-auto text-xs tabular-nums text-zinc-500">
          {rows.length} of {calls.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No calls match these filters." />
        </div>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Client</th>
              <th className={th}>Title</th>
              <th className={th}>Duration</th>
              <th className={th}>Sentiment</th>
              <th className={`${th} text-right`}>Moments</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const shown = effectiveStatus(c);
              return (
                <tr key={c.id} className={rowClass}>
                  <td className={`${td} whitespace-nowrap text-zinc-500`}>{formatDate(c.startedAt)}</td>
                  <td className={`${td} whitespace-nowrap`}>{c.clientName}</td>
                  <td className={td}>
                    <Link href={`/calls/${c.id}`} className={linkClass}>
                      {c.title || "Untitled call"}
                    </Link>
                    {c.requiresManual ? (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        manual
                      </span>
                    ) : null}
                  </td>
                  <td className={`${td} whitespace-nowrap text-zinc-500`}>{formatDuration(c.durationSeconds)}</td>
                  <td className={td}>
                    <SentimentBadge label={c.analysis?.label} score={c.analysis?.score} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{c.analysis ? c.analysis.moments.length : "–"}</td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={shown} />
                      {shown === "failed" && c.error ? (
                        <span className="max-w-64 truncate text-xs text-red-700 dark:text-red-300" title={c.error}>
                          {c.error}
                        </span>
                      ) : null}
                      {!isInProgress(shown) && (canAnalyze(c) || canRetry(c)) ? (
                        <AnalyzeButton
                          callId={c.id}
                          retry={canRetry(c)}
                          size="small"
                          onStart={() => setPending((p) => ({ ...p, [c.id]: c.status }))}
                          onDone={() =>
                            setPending((p) => {
                              const next = { ...p };
                              delete next[c.id];
                              return next;
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </section>
  );
}
