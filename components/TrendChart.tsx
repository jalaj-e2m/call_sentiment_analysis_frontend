"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/sentiment";
import { EmptyState } from "./ui";

const PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488"];

/** Score over time, one line per client, with toggles. */
export function TrendChart({ data, series }: { data: TrendPoint[]; series: { id: string; name: string }[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const colour = (index: number) => PALETTE[index % PALETTE.length];

  if (data.length === 0) return <EmptyState title="No analysed calls yet." />;

  return (
    <div>
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {series.map((s, index) => {
            const on = !hidden.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    return next;
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                  on ? "border-zinc-300 dark:border-zinc-600" : "border-dashed border-zinc-300 opacity-50 dark:border-zinc-700"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour(index) }} />
                {s.name}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
            <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            {series.map((s, index) =>
              hidden.has(s.id) ? null : (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={colour(index)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
