"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Moment, Segment } from "@/lib/model";
import { findSegmentForMoment, formatTimestamp } from "@/lib/sentiment";
import { EmotionChip, IntensityDots } from "./sentiment";
import { Card, EmptyState, Notice, buttonClass } from "./ui";

const PAGE_SIZE = 100;

export function MomentsAndTranscript({ moments, segments }: { moments: Moment[]; segments: Segment[] }) {
  const sorted = useMemo(
    () => [...moments].sort((a, b) => (a.timestampSeconds ?? Infinity) - (b.timestampSeconds ?? Infinity)),
    [moments],
  );
  const momentSegment = useMemo(
    () => new Map(sorted.map((m) => [m.id, findSegmentForMoment(segments, m.timestampSeconds)])),
    [sorted, segments],
  );
  const highlighted = useMemo(
    () => new Set([...momentSegment.values()].filter((i): i is number => i !== null)),
    [momentSegment],
  );
  const position = useMemo(() => new Map(segments.map((s, p) => [s.i, p])), [segments]);

  const [page, setPage] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const segmentRefs = useRef(new Map<number, HTMLLIElement>());
  const pages = Math.max(1, Math.ceil(segments.length / PAGE_SIZE));
  const visible = segments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (focused === null) return;
    segmentRefs.current.get(focused)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused, page]);

  function jumpTo(segmentIndex: number | null) {
    if (segmentIndex === null) return;
    const p = position.get(segmentIndex);
    if (p === undefined) return;
    setPage(Math.floor(p / PAGE_SIZE));
    setFocused(segmentIndex);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title={`Moments (${sorted.length})`} className="lg:col-span-2">
        {sorted.length === 0 ? (
          <EmptyState title="No client moments." />
        ) : (
          <ol className="space-y-3">
            {sorted.map((m) => {
              const target = momentSegment.get(m.id) ?? null;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(target)}
                    disabled={target === null}
                    className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-400 disabled:cursor-default dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <EmotionChip emotion={m.emotion} polarity={m.polarity} />
                      <IntensityDots intensity={m.intensity} />
                      <span className="text-sm font-medium">{m.topic}</span>
                      <span className="ml-auto font-mono text-xs text-zinc-500">{formatTimestamp(m.timestampSeconds)}</span>
                    </div>
                    {m.quoteVerified ? (
                      <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-sm italic dark:border-zinc-600">
                        “{m.quote}”
                      </blockquote>
                    ) : (
                      <div className="mt-2 space-y-1">
                        <Notice tone="warning">Quote not matched to transcript. Do not treat it as evidence.</Notice>
                        <p className="pl-3 text-sm italic text-zinc-500 line-through decoration-zinc-300">“{m.quote}”</p>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">{m.speaker ?? "Unknown speaker"}</p>
                    {m.reasoning ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{m.reasoning}</p> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card title={`Transcript (${segments.length} segments)`} className="lg:col-span-3">
        {segments.length === 0 ? (
          <EmptyState title="No transcript stored for this call." />
        ) : (
          <>
            <ol className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
              {visible.map((s) => {
                const isMoment = highlighted.has(s.i);
                const isFocused = focused === s.i;
                return (
                  <li
                    key={s.i}
                    ref={(el) => {
                      if (el) segmentRefs.current.set(s.i, el);
                      else segmentRefs.current.delete(s.i);
                    }}
                    data-segment={s.i}
                    className={`rounded-md px-2 py-1 text-sm ${
                      isFocused
                        ? "bg-amber-100 ring-2 ring-amber-400 dark:bg-amber-500/20"
                        : isMoment
                          ? "bg-amber-50 dark:bg-amber-500/10"
                          : ""
                    }`}
                  >
                    <span className="mr-2 font-mono text-xs text-zinc-500">{formatTimestamp(s.startSeconds)}</span>
                    <span className="mr-1 font-medium">{s.speakerName ?? "Unknown"}:</span>
                    <span>{s.text}</span>
                  </li>
                );
              })}
            </ol>
            {pages > 1 ? (
              <div className="mt-3 flex items-center justify-between text-xs">
                <button type="button" className={buttonClass} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span>
                  Page {page + 1} of {pages}
                </span>
                <button type="button" className={buttonClass} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
