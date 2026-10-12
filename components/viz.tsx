import Link from "next/link";
import type { ReactNode } from "react";
import { scoreBand, type Coverage, type HeatmapRow, type Week, type WeekCell } from "@/lib/analytics";
import type { Polarity } from "@/lib/model";
import { Tip } from "./tooltip";

const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Tiny weekly-average line (1-10) through the weeks that have a scored call. */
export function Sparkline({ cells, width = 80, height = 22 }: { cells: Pick<WeekCell, "average">[]; width?: number; height?: number }) {
  const values = cells.map((c) => c.average);
  const scored = values.filter((v): v is number => v !== null);
  if (scored.length === 0) {
    return <span className="text-xs text-zinc-500 dark:text-zinc-400">No scores</span>;
  }
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const x = (i: number) => 2 + i * step;
  const y = (v: number) => 2 + ((10 - v) / 9) * (height - 4);
  const points = values.flatMap((v, i) => (v === null ? [] : [`${x(i).toFixed(1)},${y(v).toFixed(1)}`])).join(" ");
  const lastIndex = values.findLastIndex((v) => v !== null);
  const last = values[lastIndex]!;
  const dotColour = { unhappy: "var(--sent-unhappy)", neutral: "var(--sent-neutral)", happy: "var(--sent-happy)" }[scoreBand(last)];
  const first = scored[0]!;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Weekly average ${scored.length > 1 ? `from ${fmt(first)} to ${fmt(last)}` : fmt(last)}`}
      className="overflow-visible text-zinc-400 dark:text-zinc-500"
    >
      <line x1={0} x2={width} y1={y(6.5)} y2={y(6.5)} stroke="var(--chart-grid)" strokeDasharray="2 2" />
      {scored.length > 1 ? <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" /> : null}
      <circle cx={x(lastIndex)} cy={y(last)} r={2.5} fill={dotColour} />
    </svg>
  );
}

/** Analysed of total as a bar plus text. */
export function CoverageBar({ coverage, compact = false }: { coverage: Coverage; compact?: boolean }) {
  const pct = coverage.ratio === null ? 0 : Math.round(coverage.ratio * 100);
  const low = coverage.ratio !== null && coverage.ratio < 0.5;
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${coverage.analysed} of ${coverage.total} calls analysed`}>
      <span className={`relative h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700 ${compact ? "w-12" : "w-20"}`} aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${low ? "bg-sent-neutral" : "bg-zinc-500 dark:bg-zinc-400"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`text-xs tabular-nums ${low ? "font-medium text-sent-neutral-fg" : "text-zinc-600 dark:text-zinc-400"}`} aria-hidden>
        {coverage.analysed}/{coverage.total}
      </span>
    </span>
  );
}

/** Horizontal bars with a label and a count on every row (no colour-only meaning). */
export function BarList({
  items,
  polarity = "negative",
  label,
}: {
  items: { label: string; value: number; href?: string }[];
  polarity?: Polarity;
  label: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fill = polarity === "negative" ? "bg-sent-unhappy/20 dark:bg-sent-unhappy/25" : "bg-sent-happy/20";
  return (
    <ul className="space-y-1.5" aria-label={label}>
      {items.map((item) => (
        <li key={item.label} className="relative flex items-center justify-between gap-3 rounded px-2 py-1 text-sm">
          <span aria-hidden className={`absolute inset-y-0 left-0 rounded ${fill}`} style={{ width: `${(item.value / max) * 100}%` }} />
          <span className="relative truncate text-zinc-800 first-letter:uppercase dark:text-zinc-200">{item.label}</span>
          <span className="relative shrink-0 tabular-nums text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Negative vs positive moment counts per row, as a split bar with both numbers. */
export function EmotionMixBars({ rows, label }: { rows: { key: string; label: ReactNode; negative: number; positive: number }[]; label: string }) {
  return (
    <ul className="space-y-2.5" aria-label={label}>
      {rows.map((r) => {
        const total = r.negative + r.positive;
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-zinc-800 dark:text-zinc-200">{r.label}</span>
            <span className="flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
              <span className="bg-sent-unhappy" style={{ width: `${(r.negative / total) * 100}%` }} />
              <span className="bg-sent-happy/60" style={{ width: `${(r.positive / total) * 100}%` }} />
            </span>
            <span className="whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
              <span className={r.negative ? "font-medium text-sent-unhappy-fg" : ""}>{r.negative} neg</span>
              <span aria-hidden> · </span>
              <span>{r.positive} pos</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const CELL_CLASS = {
  unhappy: "bg-sent-unhappy text-white font-semibold dark:text-zinc-950",
  neutral: "bg-sent-neutral/35 text-sent-neutral-fg font-medium",
  happy: "bg-sent-happy/15 text-sent-happy-fg",
} as const;

/** Clients x ISO weeks, each cell the week's average score (number shown in the cell). */
export function Heatmap({ rows, weeks, hrefFor }: { rows: HeatmapRow[]; weeks: Week[]; hrefFor: (clientId: string) => string }) {
  const labelEvery = weeks.length > 14 ? 2 : 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">Average score per client per week. Empty cells have no analysed call.</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-white pr-2 text-left font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              Client
            </th>
            {weeks.map((w, i) => (
              <th key={w.key} scope="col" className="min-w-8 px-0.5 pb-1 text-center font-normal text-zinc-500 dark:text-zinc-400">
                <span className={i % labelEvery === 0 ? "" : "sr-only"}>{shortDate(w.start)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.client.id}>
              <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-white pr-2 text-left font-medium text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                <Link href={hrefFor(row.client.id)} className="hover:underline">
                  {row.client.name}
                </Link>
              </th>
              {row.cells.map((cell) => {
                const label = `${row.client.name}, week of ${shortDate(cell.weekStart)}: ${
                  cell.average === null ? "no analysed calls" : `average ${fmt(cell.average)}, ${cell.count} call${cell.count === 1 ? "" : "s"}`
                }`;
                return (
                  <td key={cell.week} className="p-0">
                    {cell.average === null ? (
                      <span className="block h-7 rounded-sm bg-zinc-50 dark:bg-zinc-800/40" aria-label={label} role="img" />
                    ) : (
                      <Tip
                        content={
                          <>
                            <span className="font-medium">{row.client.name}</span> · week of {shortDate(cell.weekStart)}
                            <br />
                            Average {fmt(cell.average)} from {cell.count} call{cell.count === 1 ? "" : "s"}
                          </>
                        }
                      >
                        <Link
                          href={hrefFor(row.client.id)}
                          aria-label={label}
                          className={`flex h-7 items-center justify-center rounded-sm tabular-nums outline-offset-1 hover:ring-2 hover:ring-zinc-400 ${CELL_CLASS[scoreBand(cell.average)]}`}
                        >
                          {Math.round(cell.average)}
                        </Link>
                      </Tip>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
