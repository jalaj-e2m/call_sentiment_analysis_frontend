"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { scoreBand, type TimelineSeries } from "@/lib/analytics";
import { EmptyState } from "./ui";

/** Categorical client colours; red, amber and green are kept for sentiment only. */
const PALETTE = ["#6366f1", "#0ea5e9", "#a855f7", "#64748b", "#ec4899", "#06b6d4", "#8b5cf6", "#3b82f6", "#d946ef", "#0f766e"];
const DEFAULT_VISIBLE = 5;
const BAND_TEXT = { unhappy: "unhappy", neutral: "neutral", happy: "happy" } as const;

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const avg = (s: TimelineSeries) => s.points.reduce((n, p) => n + p.score, 0) / s.points.length;

interface TipPayload {
  payload?: { t: number; score: number; label: string };
  name?: string;
  color?: string;
}

function TimelineTooltip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  const p = payload?.[0];
  if (!active || !p?.payload) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        {day(p.payload.t)} · {p.payload.label}
      </p>
      <p className="mt-0.5 tabular-nums text-zinc-800 dark:text-zinc-200">
        Score {p.payload.score} ({BAND_TEXT[scoreBand(p.payload.score)]})
      </p>
    </div>
  );
}

/**
 * Score over real time: straight segments with a dot per call, y 1-10 with the three bands shaded,
 * one toggle per client. Clicking a dot opens the call.
 */
export function ScoreTimeline({ series, domain, height = 260 }: { series: TimelineSeries[]; domain: [number, number]; height?: number }) {
  const router = useRouter();
  const colours = useMemo(() => new Map(series.map((s, i) => [s.clientId, PALETTE[i % PALETTE.length]!])), [series]);
  const initial = useMemo(() => {
    if (series.length <= DEFAULT_VISIBLE) return new Set(series.map((s) => s.clientId));
    return new Set([...series].sort((a, b) => avg(a) - avg(b)).slice(0, DEFAULT_VISIBLE).map((s) => s.clientId));
  }, [series]);
  const [visible, setVisible] = useState<Set<string> | null>(null);
  const shown = visible ?? initial;

  if (series.length === 0) return <EmptyState title="No scored calls in this period." />;

  const toggle = (id: string) =>
    setVisible(() => {
      const next = new Set(shown);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [from, to] = domain;
  const spanDays = (to - from) / 86_400_000;
  const ticks = Array.from({ length: 6 }, (_, i) => from + ((to - from) * i) / 5);

  return (
    <figure>
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {series.map((s) => {
            const on = shown.has(s.clientId);
            return (
              <button
                key={s.clientId}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.clientId)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                  on
                    ? "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                    : "border-dashed border-zinc-300 text-zinc-500 line-through dark:border-zinc-700"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? colours.get(s.clientId) : "transparent", outline: `1px solid ${colours.get(s.clientId)}` }} aria-hidden />
                {s.name}
              </button>
            );
          })}
          <span className="ml-1 flex gap-1 text-xs">
            <button type="button" className="rounded px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800" onClick={() => setVisible(new Set(series.map((s) => s.clientId)))}>
              All
            </button>
            <button type="button" className="rounded px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800" onClick={() => setVisible(new Set())}>
              None
            </button>
          </span>
        </div>
      ) : null}
      <div style={{ height }} className="w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
            <ReferenceArea y1={1} y2={4.5} fill="var(--sent-unhappy)" fillOpacity={0.07} ifOverflow="hidden" />
            <ReferenceArea y1={4.5} y2={6.5} fill="var(--sent-neutral)" fillOpacity={0.07} ifOverflow="hidden" />
            <ReferenceArea y1={6.5} y2={10} fill="var(--sent-happy)" fillOpacity={0.05} ifOverflow="hidden" />
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[from, to]}
              ticks={ticks}
              tickFormatter={(t: number) => (spanDays > 400 ? new Date(t).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : day(t))}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
              stroke="var(--chart-grid)"
              allowDuplicatedCategory={false}
            />
            <YAxis domain={[1, 10]} ticks={[1, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} stroke="var(--chart-grid)" allowDecimals={false} />
            <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
            {series
              .filter((s) => shown.has(s.clientId))
              .map((s) => (
                <Line
                  key={s.clientId}
                  data={s.points}
                  dataKey="score"
                  name={s.name}
                  type="linear"
                  stroke={colours.get(s.clientId)}
                  strokeWidth={1.75}
                  dot={{ r: 3, strokeWidth: 0, fill: colours.get(s.clientId) }}
                  activeDot={{
                    r: 5,
                    cursor: "pointer",
                    onClick: (_: unknown, event: unknown) => {
                      const payload = (event as { payload?: { callId?: string } })?.payload;
                      if (payload?.callId) router.push(`/calls/${payload.callId}`);
                    },
                  }}
                  isAnimationActive={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Score timeline, 1 to 10. Bands: 1 to 4 unhappy, 5 to 6 neutral, 7 to 10 happy.{" "}
        {series
          .map((s) => {
            const last = s.points.at(-1)!;
            return `${s.name}: ${s.points.length} scored call${s.points.length === 1 ? "" : "s"}, average ${avg(s).toFixed(1)}, latest ${last.score} on ${day(last.t)}.`;
          })
          .join(" ")}
      </figcaption>
    </figure>
  );
}
