"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { PAGE_SIZE, momentCounts, paginate, sortCalls, stripClientName, type CallSortKey, type SortDir } from "@/lib/analytics";
import { triggerAnalysis } from "@/lib/analyze";
import type { AnalysisStatus, CallRow, ClientRow } from "@/lib/model";
import {
  ANALYSIS_CONCURRENCY,
  canAnalyze,
  canBulkAnalyze,
  canRetry,
  formatDate,
  formatDuration,
  isInProgress,
  runWithConcurrency,
} from "@/lib/sentiment";
import { AnalyzeButton } from "./AnalyzeButton";
import { AutoRefresh } from "./AutoRefresh";
import { FilterChip, ToggleChip } from "./filters";
import { MomentDots, ScoreChip, Spinner } from "./sentiment";
import { Tip } from "./tooltip";
import { EmptyState, TableWrap, inputClass, primaryButtonClass, rowClass, smallButtonClass, surfaceClass, td, th } from "./ui";

export interface CallFilters {
  clients: string[];
  labels: string[];
  statuses: string[];
  manualOnly: boolean;
}

const LABEL_OPTIONS = [
  { value: "unhappy", label: "Unhappy" },
  { value: "neutral", label: "Neutral" },
  { value: "happy", label: "Happy" },
  { value: "none", label: "Not analysed" },
];
const STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "running", label: "Running or queued" },
  { value: "failed", label: "Failed" },
  { value: "not_started", label: "Not started" },
];

const statusMatches = (status: AnalysisStatus, wanted: string[]) =>
  wanted.includes(status) || (wanted.includes("running") && status === "queued");

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  column: CallSortKey;
  sort: { key: CallSortKey; dir: SortDir };
  onSort: (key: CallSortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`${th} ${className}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} scope="col">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:hover:text-zinc-100"
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} aria-hidden />
      </button>
    </th>
  );
}

export function CallsTable({
  calls,
  clients,
  initial,
}: {
  calls: CallRow[];
  clients: ClientRow[];
  initial: CallFilters;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CallFilters>(initial);
  const [sort, setSort] = useState<{ key: CallSortKey; dir: SortDir }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Optimistic "queued" until the server reports a different status than when analysis was started.
  const [pending, setPending] = useState<Record<string, AnalysisStatus>>({});
  const [bulk, setBulk] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const effectiveStatus = (c: CallRow): AnalysisStatus => (pending[c.id] === c.status ? "queued" : c.status);
  const update = (patch: Partial<CallFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = calls.filter(
      (c) =>
        (!q || `${c.title ?? ""} ${c.clientName}`.toLowerCase().includes(q)) &&
        (filters.clients.length === 0 || filters.clients.includes(c.clientId ?? "")) &&
        (filters.labels.length === 0 || filters.labels.includes(c.analysis?.label ?? "none")) &&
        (filters.statuses.length === 0 || statusMatches(c.status, filters.statuses)) &&
        (!filters.manualOnly || c.requiresManual),
    );
    return sortCalls(filtered, sort.key, sort.dir);
  }, [calls, query, filters, sort]);

  const view = paginate(rows, page);
  const polling = calls.some((c) => isInProgress(c.status) || pending[c.id] === c.status);
  const selectedCalls = calls.filter((c) => selected.has(c.id));
  const eligible = selectedCalls.filter(canBulkAnalyze);
  const skippedManual = selectedCalls.filter((c) => c.requiresManual && !c.analysis).length;
  const pageIds = view.items.map((c) => c.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const anyFilter = query || filters.clients.length || filters.labels.length || filters.statuses.length || filters.manualOnly;

  function onSort(key: CallSortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "client" ? "asc" : "desc" }));
    setPage(0);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((s) => {
      const next = new Set(s);
      for (const id of pageIds) {
        if (allOnPage) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const clearPending = (id: string) =>
    setPending((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });

  async function analyzeSelected() {
    const targets = eligible;
    if (targets.length === 0 || bulk) return;
    setBulkMessage(null);
    setPending((p) => ({ ...p, ...Object.fromEntries(targets.map((c) => [c.id, c.status])) }));
    const progress = { done: 0, failed: 0, total: targets.length };
    setBulk({ ...progress });
    await runWithConcurrency(
      targets.map((c) => c.id),
      ANALYSIS_CONCURRENCY,
      async (id) => {
        const result = await triggerAnalysis(id);
        progress.done += 1;
        if (!result.ok) progress.failed += 1;
        setBulk({ ...progress });
        clearPending(id);
        router.refresh();
      },
    );
    setBulk(null);
    setSelected(new Set());
    setBulkMessage(
      `${progress.done - progress.failed} analysed${progress.failed ? `, ${progress.failed} failed (use Retry on the row)` : ""}.`,
    );
  }

  function openRow(e: MouseEvent<HTMLTableRowElement>, id: string) {
    if ((e.target as HTMLElement).closest("a, button, input, label")) return;
    if (window.getSelection()?.toString()) return;
    router.push(`/calls/${id}`);
  }

  return (
    <section className={surfaceClass}>
      <AutoRefresh active={polling} />
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <label className="relative">
          <span className="sr-only">Search calls</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search title or client"
            className={`${inputClass} h-8 w-56 pl-8`}
          />
        </label>
        <FilterChip
          label="Client"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
          selected={filters.clients}
          onChange={(v) => update({ clients: v })}
        />
        <FilterChip label="Label" options={LABEL_OPTIONS} selected={filters.labels} onChange={(v) => update({ labels: v })} />
        <FilterChip label="Status" options={STATUS_OPTIONS} selected={filters.statuses} onChange={(v) => update({ statuses: v })} />
        <ToggleChip label="Manual-only" pressed={filters.manualOnly} onChange={(v) => update({ manualOnly: v })} />
        {anyFilter ? (
          <button
            type="button"
            className="text-xs text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            onClick={() => {
              setQuery("");
              update({ clients: [], labels: [], statuses: [], manualOnly: false });
            }}
          >
            Reset
          </button>
        ) : null}
        <span className="ml-auto text-xs tabular-nums text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {rows.length} of {calls.length} calls
        </span>
      </div>

      {selected.size > 0 || bulk || bulkMessage ? (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300"
          aria-live="polite"
        >
          {bulk ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Analysing {bulk.done}/{bulk.total}
              {bulk.failed ? `, ${bulk.failed} failed` : ""}. Keep this tab open.
            </span>
          ) : selected.size > 0 ? (
            <>
              <span className="font-medium">{selected.size} selected</span>
              <span>
                {eligible.length} can be analysed
                {skippedManual ? ` · ${skippedManual} manual-only skipped (analyse them one by one)` : ""}
              </span>
              <button type="button" className={`${primaryButtonClass} h-7 text-xs`} disabled={eligible.length === 0} onClick={analyzeSelected}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Analyze selected
              </button>
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            </>
          ) : (
            <span>{bulkMessage}</span>
          )}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No calls match these filters." />
        </div>
      ) : (
        <>
          <TableWrap minWidth={880} maxHeight="calc(100vh - 16rem)">
            <thead>
              <tr>
                <th className={`${th} w-8`} scope="col">
                  <input
                    type="checkbox"
                    aria-label={allOnPage ? "Deselect calls on this page" : "Select calls on this page"}
                    checked={allOnPage}
                    onChange={togglePage}
                    className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                  />
                </th>
                <SortHeader label="Date" column="date" sort={sort} onSort={onSort} />
                <SortHeader label="Client" column="client" sort={sort} onSort={onSort} />
                <th className={th} scope="col">
                  Title
                </th>
                <SortHeader label="Duration" column="duration" sort={sort} onSort={onSort} />
                <SortHeader label="Score" column="score" sort={sort} onSort={onSort} />
                <th className={th} scope="col">
                  Moments
                </th>
                <th className={`${th} w-36`} scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((c) => {
                const shown = effectiveStatus(c);
                const title = stripClientName(c.title, c.clientName);
                return (
                  <tr
                    key={c.id}
                    className={`${rowClass} cursor-pointer ${selected.has(c.id) ? "bg-indigo-50/50 dark:bg-indigo-500/5" : ""}`}
                    onClick={(e) => openRow(e, c.id)}
                  >
                    <td className={td}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.clientName}: ${title}`}
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                      />
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-400`}>{formatDate(c.startedAt)}</td>
                    <td className={`${td} max-w-44 truncate whitespace-nowrap text-zinc-800 dark:text-zinc-200`}>{c.clientName}</td>
                    <td className={`${td} max-w-80`}>
                      <span className="flex items-center gap-2">
                        <Link href={`/calls/${c.id}`} className="truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                          {title}
                        </Link>
                        {c.requiresManual ? (
                          <Tip content={`Manual-only: ${c.manualLabel ?? "marked for manual analysis"}`}>
                            <button
                              type="button"
                              aria-label={`Manual-only: ${c.manualLabel ?? "marked for manual analysis"}`}
                              className="shrink-0 rounded border border-zinc-200 px-1 text-[10px] font-medium uppercase leading-4 tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                            >
                              M
                            </button>
                          </Tip>
                        ) : null}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-400`}>{formatDuration(c.durationSeconds)}</td>
                    <td className={td}>
                      <ScoreChip score={c.analysis?.score} lowEvidence={!!c.analysis && c.analysis.moments.length === 0} />
                    </td>
                    <td className={td}>{c.analysis ? <MomentDots {...momentCounts(c.analysis.moments)} /> : null}</td>
                    <td className={td}>
                      <StatusCell call={c} shown={shown} onStart={() => setPending((p) => ({ ...p, [c.id]: c.status }))} onDone={() => clearPending(c.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <nav className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400" aria-label="Pagination">
            <span className="tabular-nums">
              {view.page * PAGE_SIZE + 1}–{view.page * PAGE_SIZE + view.items.length} of {rows.length}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">
                Page {view.page + 1} of {view.pages}
              </span>
              <button type="button" className={smallButtonClass} onClick={() => setPage(view.page - 1)} disabled={view.page === 0} aria-label="Previous page">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" className={smallButtonClass} onClick={() => setPage(view.page + 1)} disabled={view.page >= view.pages - 1} aria-label="Next page">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </nav>
        </>
      )}
    </section>
  );
}

/** One cell: Done, Running (spinner), Failed with Retry, or Analyze. */
function StatusCell({
  call,
  shown,
  onStart,
  onDone,
}: {
  call: CallRow;
  shown: AnalysisStatus;
  onStart: () => void;
  onDone: () => void;
}) {
  if (isInProgress(shown)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <Spinner />
        {shown === "queued" ? "Queued" : "Running"}
      </span>
    );
  }
  if (canRetry(call)) {
    return (
      <span className="inline-flex items-center gap-2">
        <Tip content={call.error ? `Failed: ${call.error}` : "Analysis failed"}>
          <button type="button" className="text-xs font-medium text-sent-unhappy-fg underline decoration-dotted underline-offset-2">
            Failed
          </button>
        </Tip>
        <AnalyzeButton callId={call.id} retry size="small" onStart={onStart} onDone={onDone} />
      </span>
    );
  }
  if (canAnalyze(call)) {
    return <AnalyzeButton callId={call.id} size="small" onStart={onStart} onDone={onDone} />;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
      <Check className="h-3.5 w-3.5" aria-hidden />
      Done
    </span>
  );
}
