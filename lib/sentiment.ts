/** Pure presentation logic. No I/O; every function is unit-tested. Period analytics live in analytics.ts. */
import type { AnalysisDetail, CallRow, Person, Polarity, Segment, SentimentLabel, SyncResult } from "./model";

// Sentiment colours ---------------------------------------------------------------------------
// Colours come from the CSS variables in app/globals.css (--sent-*, --pol-*), light and dark.
// Strong colour is reserved for unhappy/neutral; happy is deliberately calm.

export interface BadgeStyle {
  text: string;
  className: string;
}

const LABEL_STYLES: Record<SentimentLabel, BadgeStyle> = {
  happy: { text: "Happy", className: "bg-sent-happy-soft text-sent-happy-fg ring-sent-happy-line" },
  neutral: { text: "Neutral", className: "bg-sent-neutral-soft text-sent-neutral-fg ring-sent-neutral-line" },
  unhappy: { text: "Unhappy", className: "bg-sent-unhappy-soft text-sent-unhappy-fg ring-sent-unhappy-line" },
};

const NO_LABEL: BadgeStyle = {
  text: "Not analysed",
  className: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-400",
};

export function labelStyle(label: SentimentLabel | null | undefined): BadgeStyle {
  return label ? LABEL_STYLES[label] : NO_LABEL;
}

/** CSS colour for charts and markers. */
export const LABEL_COLOR: Record<SentimentLabel, string> = {
  happy: "var(--sent-happy)",
  neutral: "var(--sent-neutral)",
  unhappy: "var(--sent-unhappy)",
};
export const POLARITY_COLOR: Record<Polarity, string> = {
  negative: "var(--pol-negative)",
  positive: "var(--pol-positive)",
  neutral: "var(--pol-neutral)",
};

export function polarityClass(polarity: Polarity): string {
  switch (polarity) {
    case "negative":
      return "bg-sent-unhappy-soft text-sent-unhappy-fg ring-sent-unhappy-line";
    case "positive":
      return "bg-sent-happy-soft text-sent-happy-fg ring-sent-happy-line";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-300";
  }
}

// Formatting ----------------------------------------------------------------------------------

export function formatTimestamp(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return "--:--";
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "–";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Evidence ------------------------------------------------------------------------------------

export const LOW_EVIDENCE_MESSAGE =
  "No client moments were found (the client may have spoken little). The score is low-confidence.";
export const NO_EVIDENCE_SCORE_MESSAGE = "Not enough client evidence for a score.";

/** True when the analysis has no client moments, or no score at all. */
export function isLowEvidence(analysis: Pick<AnalysisDetail, "score" | "moments" | "dropped">): boolean {
  if (analysis.score === null) return true;
  if (analysis.moments.length === 0) return true;
  return false;
}

// Moments and transcript ----------------------------------------------------------------------

/** Index (segment.i) of the segment whose start is closest to the timestamp; ties go to the earlier one. */
export function findSegmentForMoment(segments: Segment[], timestampSeconds: number | null): number | null {
  if (timestampSeconds === null || !Number.isFinite(timestampSeconds)) return null;
  let best: { i: number; distance: number } | null = null;
  for (const s of segments) {
    if (s.startSeconds === null) continue;
    const distance = Math.abs(s.startSeconds - timestampSeconds);
    if (!best || distance < best.distance) best = { i: s.i, distance };
  }
  return best?.i ?? null;
}

// Analyze and retry ---------------------------------------------------------------------------

export const isInProgress = (status: CallRow["status"]) => status === "running" || status === "queued";
/** Any call without an analysis can be analysed by hand (manual-only calls, and auto calls left over after a sync). */
export const canAnalyze = (call: CallRow) => !call.analysis && !isInProgress(call.status) && call.status !== "failed";
export const canRetry = (call: CallRow) => call.status === "failed";
/** Bulk "Analyze selected" skips manual-only calls: those need a deliberate, one-by-one decision. */
export const canBulkAnalyze = (call: CallRow) => !call.requiresManual && (canAnalyze(call) || canRetry(call));
/** Analyses run from the browser at most this many at a time (after a sync and for bulk Analyze). */
export const ANALYSIS_CONCURRENCY = 2;

// Meeting people ------------------------------------------------------------------------------

export interface RecordingPeople {
  invitees: unknown;
  recordedByName: string | null;
  recordedByEmail: string | null;
}

const cleanText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Invitees of every recording of a call plus the recorder, one entry per email (or per name when
 * there is no email). E2M vs client comes from the e2m_domains setting, not Fathom's is_external,
 * which is unreliable for E2M's two domains. Clients first, then by name.
 */
export function meetingPeople(recordings: RecordingPeople[], e2mDomains: string[], speakerNames: (string | null)[]): Person[] {
  const domains = new Set(e2mDomains.map((d) => d.toLowerCase()));
  const speakers = new Set(speakerNames.filter((n): n is string => !!n).map((n) => n.trim().toLowerCase()));
  const byKey = new Map<string, Person>();

  function add(name: string | null, email: string | null, recorder: boolean) {
    const normalizedEmail = email?.toLowerCase() ?? null;
    const key = normalizedEmail ?? (name ? `name:${name.toLowerCase()}` : null);
    if (!key) return;
    const existing = byKey.get(key);
    if (existing) {
      existing.name ??= name;
      existing.recorder ||= recorder;
      existing.spoke ||= !!name && speakers.has(name.toLowerCase());
      return;
    }
    const domain = normalizedEmail?.split("@")[1] ?? null;
    byKey.set(key, {
      name,
      email: normalizedEmail,
      side: domain && domains.has(domain) ? "e2m" : "client",
      recorder,
      spoke: !!name && speakers.has(name.toLowerCase()),
    });
  }

  for (const r of recordings) {
    for (const invitee of Array.isArray(r.invitees) ? r.invitees : []) {
      if (invitee && typeof invitee === "object") {
        const i = invitee as { name?: unknown; email?: unknown };
        add(cleanText(i.name), cleanText(i.email), false);
      }
    }
    add(cleanText(r.recordedByName), cleanText(r.recordedByEmail), true);
  }

  return [...byKey.values()].sort(
    (a, b) =>
      (a.side === b.side ? 0 : a.side === "client" ? -1 : 1) ||
      (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""),
  );
}

// Fathom sync ---------------------------------------------------------------------------------

/** "just now", "5 min ago", "3 h ago", "2 d ago", else a date. */
export function formatRelative(iso: string | null | undefined, now: Date): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const minutes = Math.floor((now.getTime() - t) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))} d ago`;
  return formatDate(iso);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One line describing a sync result, e.g. "2 new client calls (1 manual-only) · 3 already imported". */
export function describeSyncResult(result: SyncResult | null | undefined): string {
  if (!result) return "No sync yet.";
  const newCalls = result.new_calls ?? 0;
  const parts = [
    newCalls === 0
      ? "No new client calls"
      : `${plural(newCalls, "new client call")}${result.manual_only ? ` (${result.manual_only} manual-only)` : ""}`,
  ];
  const already = (result.skipped ?? 0) + (result.importedElsewhere ?? 0);
  if (already) parts.push(`${already} already imported`);
  if (result.callsMerged) {
    parts.push(`${plural(result.callsMerged, "recording")} added to a call a colleague already synced`);
  }
  const rejected = Object.values(result.rejected ?? {}).reduce((n, v) => n + v, 0);
  if (rejected) parts.push(`${plural(rejected, "non-client meeting")} skipped`);
  if (result.failed) parts.push(`${result.failed} failed`);
  return parts.join(" · ");
}

/** Run `worker` over `items` with at most `limit` in flight; resolves when all are done. */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]!, index);
    }
  });
  await Promise.all(lanes);
}
