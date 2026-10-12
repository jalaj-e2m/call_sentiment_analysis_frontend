"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { groupMoments, timelineLength, timelinePosition } from "@/lib/analytics";
import type { Moment, Polarity, Segment } from "@/lib/model";
import { findSegmentForMoment, formatTimestamp } from "@/lib/sentiment";
import { EmotionChip, IntensityDots } from "./sentiment";
import { Tip } from "./tooltip";
import { Card, EmptyState, Notice, smallButtonClass } from "./ui";

const PAGE_SIZE = 100;
const GROUP_TITLE: Record<Polarity, string> = { negative: "Negative", positive: "Positive", neutral: "Neutral" };
const MARKER_SIZE = [0, 10, 14, 18];
const MARKER_CLASS: Record<Polarity, string> = {
  negative: "bg-sent-unhappy ring-white dark:ring-zinc-900",
  positive: "bg-sent-happy ring-white dark:ring-zinc-900",
  neutral: "bg-pol-neutral ring-white dark:ring-zinc-900",
};

function tickStep(lengthSeconds: number): number {
  const minutes = lengthSeconds / 60;
  return [1, 2, 5, 10, 15, 30, 60].find((s) => minutes / s <= 8) ?? 120;
}

/** x = minutes into the call; negative moments below the line, positive above; size = intensity. */
function EmotionTimeline({
  moments,
  length,
  active,
  onPick,
}: {
  moments: Moment[];
  length: number;
  active: string | null;
  onPick: (m: Moment) => void;
}) {
  const step = tickStep(length);
  const ticks = Array.from({ length: Math.floor(length / 60 / step) + 1 }, (_, i) => i * step);
  const placed = moments.filter((m) => timelinePosition(m.timestampSeconds, length) !== null);
  const negatives = moments.filter((m) => m.polarity === "negative").length;
  const positives = moments.filter((m) => m.polarity === "positive").length;
  return (
    <figure>
      <div className="relative mx-2 h-28" aria-hidden={placed.length === 0}>
        <span className="absolute left-0 top-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Positive</span>
        <span className="absolute bottom-6 left-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Negative</span>
        <div className="absolute inset-x-0 top-[44px] h-px bg-zinc-300 dark:bg-zinc-700" />
        {ticks.map((minute) => (
          <span
            key={minute}
            className="absolute bottom-0 -translate-x-1/2 text-[10px] tabular-nums text-zinc-500"
            style={{ left: `${Math.min(100, ((minute * 60) / length) * 100)}%` }}
          >
            {minute}m
          </span>
        ))}
        {placed.map((m) => {
          const left = timelinePosition(m.timestampSeconds, length)!;
          const size = MARKER_SIZE[Math.max(1, Math.min(3, m.intensity))]!;
          const top = m.polarity === "negative" ? 52 + (m.intensity - 1) * 8 : m.polarity === "positive" ? 36 - size - (m.intensity - 1) * 8 : 44 - size / 2;
          const label = `${formatTimestamp(m.timestampSeconds)}, ${m.polarity} ${m.emotion}, ${m.topic}, intensity ${m.intensity} of 3`;
          return (
            <Tip
              key={m.id}
              content={
                <>
                  <span className="font-medium capitalize">{m.emotion}</span> · {m.topic}
                  <br />
                  {formatTimestamp(m.timestampSeconds)} · {m.polarity} · intensity {m.intensity}/3
                </>
              }
            >
              <button
                type="button"
                aria-label={`Jump to ${label}`}
                onClick={() => onPick(m)}
                className={`absolute -translate-x-1/2 rounded-full ring-2 transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-indigo-500 ${MARKER_CLASS[m.polarity]} ${
                  active === m.id ? "scale-125 outline-2 outline-offset-2 outline-zinc-900 dark:outline-zinc-100" : ""
                }`}
                style={{ left: `${left}%`, top, width: size, height: size }}
              />
            </Tip>
          );
        })}
      </div>
      <figcaption className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {negatives} negative and {positives} positive moment{negatives + positives === 1 ? "" : "s"} over {Math.round(length / 60)} minutes.
        Larger dots are stronger. Click a dot to jump to the transcript.
      </figcaption>
    </figure>
  );
}

function MomentCard({ moment: m, active, onJump }: { moment: Moment; active: boolean; onJump: (() => void) | null }) {
  return (
    <li
      id={`moment-${m.id}`}
      className={`rounded-lg border p-3 transition-colors ${
        active ? "border-zinc-400 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-800/40" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <EmotionChip emotion={m.emotion} polarity={m.polarity} />
        <IntensityDots intensity={m.intensity} polarity={m.polarity} />
        <span className="min-w-0 text-sm font-medium">{m.topic}</span>
        {onJump ? (
          <button
            type="button"
            onClick={onJump}
            className="ml-auto rounded px-1 font-mono text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            aria-label={`Jump to ${formatTimestamp(m.timestampSeconds)} in the transcript`}
          >
            {formatTimestamp(m.timestampSeconds)}
          </button>
        ) : (
          <span className="ml-auto font-mono text-xs text-zinc-500">{formatTimestamp(m.timestampSeconds)}</span>
        )}
      </div>
      {m.quoteVerified ? (
        <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-sm italic dark:border-zinc-600">“{m.quote}”</blockquote>
      ) : (
        <div className="mt-2 space-y-1">
          <Notice tone="warning">Quote not matched to transcript. Do not treat it as evidence.</Notice>
          <p className="pl-3 text-sm italic text-zinc-500 line-through decoration-zinc-400">“{m.quote}”</p>
        </div>
      )}
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {m.speaker ?? "Unknown speaker"}
        {m.reasoning ? <> · {m.reasoning}</> : null}
      </p>
    </li>
  );
}

/**
 * Call emotion timeline on top, then two columns: `summary` (server-rendered) and the moments on
 * the left, the transcript on the right (sticky on large screens). Timeline dots and moment
 * timestamps scroll to and highlight the transcript line.
 */
export function MomentsAndTranscript({
  moments,
  segments,
  durationSeconds,
  summary,
}: {
  moments: Moment[];
  segments: Segment[];
  durationSeconds: number | null;
  summary: ReactNode;
}) {
  const momentSegment = useMemo(
    () => new Map(moments.map((m) => [m.id, findSegmentForMoment(segments, m.timestampSeconds)])),
    [moments, segments],
  );
  const highlighted = useMemo(() => new Set([...momentSegment.values()].filter((i): i is number => i !== null)), [momentSegment]);
  const position = useMemo(() => new Map(segments.map((s, p) => [s.i, p])), [segments]);
  const groups = useMemo(() => groupMoments(moments), [moments]);
  const length = useMemo(
    () => timelineLength(durationSeconds, [...moments.map((m) => m.timestampSeconds), ...segments.map((s) => s.startSeconds)]),
    [durationSeconds, moments, segments],
  );

  const [page, setPage] = useState(0);
  const [focused, setFocused] = useState<{ segment: number; nonce: number } | null>(null);
  const [activeMoment, setActiveMoment] = useState<string | null>(null);
  const segmentRefs = useRef(new Map<number, HTMLLIElement>());
  const pages = Math.max(1, Math.ceil(segments.length / PAGE_SIZE));
  const visible = segments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (focused === null) return;
    const el = segmentRefs.current.get(focused.segment);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.classList.remove("flash-line");
    void el.offsetWidth;
    el.classList.add("flash-line");
  }, [focused, page]);

  function jump(m: Moment) {
    setActiveMoment(m.id);
    const segmentIndex = momentSegment.get(m.id) ?? null;
    if (segmentIndex === null) return;
    const p = position.get(segmentIndex);
    if (p === undefined) return;
    setPage(Math.floor(p / PAGE_SIZE));
    setFocused({ segment: segmentIndex, nonce: Date.now() });
  }

  return (
    <div className="space-y-6">
      <Card title="Call emotion timeline" description="Each dot is a client moment, placed by minute into the call.">
        {moments.length === 0 ? (
          <EmptyState title="No client moments to plot." />
        ) : (
          <EmotionTimeline moments={moments} length={length} active={activeMoment} onPick={jump} />
        )}
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="min-w-0 space-y-6">
          {summary}
          <Card title={`Moments (${moments.length})`} description="Negative first, then positive; each in call order.">
            {groups.length === 0 ? (
              <EmptyState title="No client moments." />
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <section key={g.polarity} aria-label={`${GROUP_TITLE[g.polarity]} moments`}>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                      <span
                        className={`h-2 w-2 rounded-full ${g.polarity === "negative" ? "bg-sent-unhappy" : g.polarity === "positive" ? "bg-sent-happy" : "bg-pol-neutral"}`}
                        aria-hidden
                      />
                      {GROUP_TITLE[g.polarity]} ({g.moments.length})
                    </h3>
                    <ol className="space-y-2">
                      {g.moments.map((m) => (
                        <MomentCard
                          key={m.id}
                          moment={m}
                          active={activeMoment === m.id}
                          onJump={momentSegment.get(m.id) === null ? null : () => jump(m)}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 lg:sticky lg:top-24">
          <Card title="Transcript" description={`${segments.length} segments. Highlighted lines contain a client moment.`} flush>
            {segments.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No transcript stored for this call." />
              </div>
            ) : (
              <>
                <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto p-3 lg:max-h-[calc(100vh-14rem)]" aria-label="Transcript">
                  {visible.map((s) => {
                    const isMoment = highlighted.has(s.i);
                    const isFocused = focused?.segment === s.i;
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
                            ? "ring-2 ring-amber-400"
                            : isMoment
                              ? "border-l-2 border-sent-neutral bg-sent-neutral-soft"
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
                  <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
                    <button type="button" className={smallButtonClass} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </button>
                    <span>
                      Page {page + 1} of {pages}
                    </span>
                    <button type="button" className={smallButtonClass} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
