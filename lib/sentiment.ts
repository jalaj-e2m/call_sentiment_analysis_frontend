/** Pure presentation and aggregation logic. No I/O; every function is unit-tested. */
import type { AnalysisDetail, CallRow, ClientRow, Person, Polarity, Segment, SentimentLabel, SyncResult } from "./model";

const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENT_DAYS = 30;
export const ROLLING_WINDOW = 3;

// Sentiment colours ---------------------------------------------------------------------------

export interface BadgeStyle {
  text: string;
  className: string;
}

const LABEL_STYLES: Record<SentimentLabel, BadgeStyle> = {
  happy: {
    text: "Happy",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  neutral: {
    text: "Neutral",
    className: "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  },
  unhappy: {
    text: "Unhappy",
    className: "bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300",
  },
};

const NO_LABEL: BadgeStyle = {
  text: "Not analysed",
  className: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-400",
};

export function labelStyle(label: SentimentLabel | null | undefined): BadgeStyle {
  return label ? LABEL_STYLES[label] : NO_LABEL;
}

/** Line colour for charts, matching the badge colours. */
export const LABEL_HEX: Record<SentimentLabel, string> = { happy: "#059669", neutral: "#d97706", unhappy: "#dc2626" };

export function polarityClass(polarity: Polarity): string {
  switch (polarity) {
    case "negative":
      return "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300";
    case "positive":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300";
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

// Aggregations --------------------------------------------------------------------------------

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
const byNewest = (a: CallRow, b: CallRow) => time(b.startedAt) - time(a.startedAt);
const average = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

export const isRecent = (iso: string | null, now: Date, days = RECENT_DAYS) =>
  !!iso && now.getTime() - time(iso) <= days * DAY_MS && time(iso) <= now.getTime();

export const scoredCalls = (calls: CallRow[]) =>
  calls.filter((c) => c.analysis && c.analysis.score !== null).sort(byNewest);

/** Average score of the newest `window` analysed calls (by call date). */
export function rollingScore(calls: CallRow[], window = ROLLING_WINDOW): number | null {
  return average(scoredCalls(calls).slice(0, window).map((c) => c.analysis!.score!));
}

/** Compares the newest `window` scores with the `window` before them. */
export function scoreTrend(calls: CallRow[], window = ROLLING_WINDOW): "up" | "down" | "flat" | null {
  const scores = scoredCalls(calls).map((c) => c.analysis!.score!);
  if (scores.length < window + 1) return null;
  const latest = average(scores.slice(0, window))!;
  const previous = average(scores.slice(window, window * 2))!;
  if (latest - previous >= 0.5) return "up";
  if (previous - latest >= 0.5) return "down";
  return "flat";
}

export const hasStrongNegative = (call: CallRow) =>
  !!call.analysis?.moments.some((m) => m.polarity === "negative" && m.intensity >= 3);

export function needsAttention(calls: CallRow[]): CallRow[] {
  return calls.filter((c) => c.analysis && (c.analysis.label === "unhappy" || hasStrongNegative(c))).sort(byNewest);
}

export interface Kpis {
  analysedRecent: number;
  unhappyRecent: number;
  averageScoreRecent: number | null;
  awaitingManual: number;
}

export function dashboardKpis(calls: CallRow[], now: Date): Kpis {
  const recent = calls.filter((c) => c.analysis && isRecent(c.startedAt, now));
  return {
    analysedRecent: recent.length,
    unhappyRecent: recent.filter((c) => c.analysis!.label === "unhappy").length,
    averageScoreRecent: average(recent.filter((c) => c.analysis!.score !== null).map((c) => c.analysis!.score!)),
    awaitingManual: calls.filter((c) => c.requiresManual && !c.analysis).length,
  };
}

export const recentAnalysed = (calls: CallRow[], limit = 10) => calls.filter((c) => c.analysis).sort(byNewest).slice(0, limit);

export interface TrendPoint {
  date: string;
  [clientId: string]: number | string | null;
}

/** One row per call date (oldest first), with each client's score on that date. */
export function trendSeries(calls: CallRow[]): TrendPoint[] {
  const rows = new Map<string, TrendPoint>();
  for (const c of [...scoredCalls(calls)].reverse()) {
    if (!c.startedAt || !c.clientId) continue;
    const date = c.startedAt.slice(0, 10);
    const row = rows.get(date) ?? { date };
    row[c.clientId] = c.analysis!.score;
    rows.set(date, row);
  }
  return [...rows.values()];
}

export interface ClientSummary {
  client: ClientRow;
  calls: number;
  analysed: number;
  latestLabel: SentimentLabel | null;
  rollingScore: number | null;
  trend: "up" | "down" | "flat" | null;
  negativeMomentsRecent: number;
}

export function clientSummaries(clients: ClientRow[], calls: CallRow[], now: Date): ClientSummary[] {
  return clients
    .map((client) => {
      const own = calls.filter((c) => c.clientId === client.id);
      const analysed = own.filter((c) => c.analysis).sort(byNewest);
      return {
        client,
        calls: own.length,
        analysed: analysed.length,
        latestLabel: analysed[0]?.analysis?.label ?? null,
        rollingScore: rollingScore(own),
        trend: scoreTrend(own),
        negativeMomentsRecent: own
          .filter((c) => isRecent(c.startedAt, now))
          .reduce((n, c) => n + (c.analysis?.moments.filter((m) => m.polarity === "negative").length ?? 0), 0),
      };
    })
    .sort((a, b) => b.calls - a.calls || a.client.name.localeCompare(b.client.name));
}

/** Negative-moment topics with counts, most frequent first. */
export function negativeTopicCounts(calls: CallRow[]): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of calls) {
    for (const m of c.analysis?.moments ?? []) {
      if (m.polarity !== "negative") continue;
      const topic = m.topic.trim().toLowerCase();
      if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

export const isInProgress = (status: CallRow["status"]) => status === "running" || status === "queued";
/** Any call without an analysis can be analysed by hand (manual-only calls, and auto calls left over after a sync). */
export const canAnalyze = (call: CallRow) => !call.analysis && !isInProgress(call.status) && call.status !== "failed";
export const canRetry = (call: CallRow) => call.status === "failed";

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
