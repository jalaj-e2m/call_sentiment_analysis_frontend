/**
 * Period-based analytics behind the dashboard, clients and charts. Pure (no I/O, no Date.now);
 * every function is unit-tested in analytics.test.ts.
 */
import type { CallRow, ClientRow, MomentLite, Polarity, SentimentLabel } from "./model";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const toMs = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN);
const average = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const scoreOf = (c: CallRow) => c.analysis?.score ?? null;

// Date range ----------------------------------------------------------------------------------

export const RANGE_KEYS = ["7", "30", "90", "all"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const DEFAULT_RANGE: RangeKey = "30";
export const RANGE_LABELS: Record<RangeKey, string> = { "7": "7 days", "30": "30 days", "90": "90 days", all: "All time" };

export function parseRange(value: string | string[] | undefined): RangeKey {
  const v = Array.isArray(value) ? value[0] : value;
  return (RANGE_KEYS as readonly string[]).includes(v ?? "") ? (v as RangeKey) : DEFAULT_RANGE;
}

export interface Period {
  range: RangeKey;
  /** Exclusive start in ms, or null for all time. */
  start: number | null;
  end: number;
  previousStart: number | null;
}

export function periodFor(range: RangeKey, now: Date): Period {
  const end = now.getTime();
  if (range === "all") return { range, start: null, end, previousStart: null };
  const days = Number(range) * DAY_MS;
  return { range, start: end - days, end, previousStart: end - 2 * days };
}

export function inPeriod(iso: string | null, p: Period): boolean {
  const t = toMs(iso);
  return !Number.isNaN(t) && t <= p.end && (p.start === null || t > p.start);
}

function inPreviousPeriod(iso: string | null, p: Period): boolean {
  const t = toMs(iso);
  return p.start !== null && p.previousStart !== null && !Number.isNaN(t) && t > p.previousStart && t <= p.start;
}

export const callsInPeriod = (calls: CallRow[], p: Period) => calls.filter((c) => inPeriod(c.startedAt, p));

/** Link that keeps the date range and the admin's person filter (defaults stay out of the URL). */
export function rangeHref(path: string, range: RangeKey, person?: string | null): string {
  const params = [range === DEFAULT_RANGE ? null : `range=${range}`, person ? `person=${encodeURIComponent(person)}` : null].filter(Boolean);
  return params.length ? `${path}${path.includes("?") ? "&" : "?"}${params.join("&")}` : path;
}

export function periodPhrase(range: RangeKey): string {
  return range === "all" ? "all time" : `the last ${RANGE_LABELS[range]}`;
}

// Score bands ---------------------------------------------------------------------------------

export type Band = SentimentLabel;

/** 1-4 unhappy, 5-6 neutral, 7-10 happy (the shaded bands on every score chart). */
export function scoreBand(score: number): Band {
  if (score <= 4) return "unhappy";
  if (score <= 6) return "neutral";
  return "happy";
}

// ISO weeks -----------------------------------------------------------------------------------

export interface Week {
  key: string;
  /** Monday 00:00 UTC. */
  start: number;
}

export function isoWeek(ms: number): Week {
  const d = new Date(ms);
  const weekday = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - weekday);
  const year = new Date(start + 3 * DAY_MS).getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const firstMonday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS;
  const week = 1 + Math.round((start - firstMonday) / WEEK_MS);
  return { key: `${year}-W${String(week).padStart(2, "0")}`, start };
}

export const MAX_WEEKS = 26;

/** ISO weeks covering the period (all time starts at the oldest call), at most the newest 26. */
export function periodWeeks(p: Period, calls: CallRow[]): Week[] {
  let from = p.start;
  if (from === null) {
    const times = calls.map((c) => toMs(c.startedAt)).filter((t) => !Number.isNaN(t));
    from = times.length ? Math.min(...times) : p.end - 12 * WEEK_MS;
  }
  const weeks: Week[] = [];
  for (let w = isoWeek(from).start; w <= p.end; w += WEEK_MS) weeks.push(isoWeek(w));
  return weeks.slice(-MAX_WEEKS);
}

export interface WeekCell {
  week: string;
  weekStart: number;
  average: number | null;
  count: number;
}

/** Average score of each week's scored calls; null for weeks with none. */
export function weeklyAverages(calls: CallRow[], weeks: Week[]): WeekCell[] {
  const byWeek = new Map<string, number[]>();
  for (const c of calls) {
    const score = scoreOf(c);
    const t = toMs(c.startedAt);
    if (score === null || Number.isNaN(t)) continue;
    const key = isoWeek(t).key;
    byWeek.set(key, [...(byWeek.get(key) ?? []), score]);
  }
  return weeks.map((w) => {
    const scores = byWeek.get(w.key) ?? [];
    return { week: w.key, weekStart: w.start, average: average(scores), count: scores.length };
  });
}

// KPIs ----------------------------------------------------------------------------------------

export interface Coverage {
  analysed: number;
  total: number;
  ratio: number | null;
}

export const coverage = (calls: CallRow[]): Coverage => {
  const analysed = calls.filter((c) => c.analysis).length;
  return { analysed, total: calls.length, ratio: calls.length ? analysed / calls.length : null };
};

export interface PeriodKpis {
  analysed: number;
  /** Change in analysed calls vs the previous period of the same length; null for all time. */
  delta: number | null;
  averageScore: number | null;
  unhappy: number;
  coverage: Coverage;
  weekly: WeekCell[];
}

export function periodKpis(calls: CallRow[], p: Period, weeks: Week[]): PeriodKpis {
  const current = callsInPeriod(calls, p);
  const analysed = current.filter((c) => c.analysis);
  const previous = p.start === null ? null : calls.filter((c) => c.analysis && inPreviousPeriod(c.startedAt, p)).length;
  return {
    analysed: analysed.length,
    delta: previous === null ? null : analysed.length - previous,
    averageScore: average(analysed.map(scoreOf).filter((s): s is number => s !== null)),
    unhappy: analysed.filter((c) => c.analysis!.label === "unhappy").length,
    coverage: coverage(current),
    weekly: weeklyAverages(current, weeks),
  };
}

// Manual analysis reasons ---------------------------------------------------------------------

const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** "manali.sharma@x.com" -> "Manali". */
export function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return capitalise((local.split(/[._+-]/)[0] ?? local).toLowerCase());
}

/**
 * Readable reason for calls.manual_reason. "attendee_requires_manual" names the manual-only
 * attendees found on the call (analysis_policy.manual_only_if_attendee_emails).
 */
export function manualReasonLabel(reason: string | null, attendeeEmails: string[], policyEmails: string[]): string {
  if (reason === "attendee_requires_manual") {
    const policy = new Set(policyEmails.map((e) => e.toLowerCase()));
    const names = [...new Set(attendeeEmails.filter((e) => policy.has(e.toLowerCase())).map(firstNameFromEmail))];
    return names.length ? `${names.join(", ")} attended` : "Manual-only attendee";
  }
  if (reason && reason.trim()) return capitalise(reason.trim().replace(/_/g, " "));
  return "Marked for manual analysis";
}

export interface AwaitingManual {
  count: number;
  reasons: { label: string; count: number }[];
}

/** Manual-only calls without an analysis, grouped by reason, most common first. */
export function awaitingManual(calls: CallRow[]): AwaitingManual {
  const waiting = calls.filter((c) => c.requiresManual && !c.analysis);
  const counts = new Map<string, number>();
  for (const c of waiting) {
    const label = c.manualLabel ?? manualReasonLabel(c.manualReason, [], []);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    count: waiting.length,
    reasons: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

// Attention and watchlist ---------------------------------------------------------------------

export const QUIET_DAYS = 21;

export const hasNegativeAtLeast = (c: CallRow, intensity: number) =>
  !!c.analysis?.moments.some((m) => m.polarity === "negative" && m.intensity >= intensity);

const newestFirst = (a: CallRow, b: CallRow) => toMs(b.startedAt) - toMs(a.startedAt);

/** Unhappy calls or calls with an intensity-3 negative moment in the period, newest first. */
export function attentionCalls(calls: CallRow[], p: Period): CallRow[] {
  return callsInPeriod(calls, p)
    .filter((c) => c.analysis && (c.analysis.label === "unhappy" || hasNegativeAtLeast(c, 3)))
    .sort(newestFirst);
}

export function daysSince(iso: string | null, now: Date): number | null {
  const t = toMs(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export interface Watchlist {
  lowest: CallRow[];
  negative: CallRow[];
  quietClients: { client: ClientRow; daysSince: number | null }[];
}

/** Lowest 5 scores and calls with a negative moment of intensity >= 2 in the period; clients with no analysed call in 21 days. */
export function watchlist(calls: CallRow[], clients: ClientRow[], p: Period, now: Date): Watchlist {
  const current = callsInPeriod(calls, p);
  const lowest = current
    .filter((c) => scoreOf(c) !== null)
    .sort((a, b) => scoreOf(a)! - scoreOf(b)! || newestFirst(a, b))
    .slice(0, 5);
  const negative = current.filter((c) => hasNegativeAtLeast(c, 2)).sort(newestFirst).slice(0, 5);
  const quietClients = clients
    .map((client) => {
      const last = calls
        .filter((c) => c.clientId === client.id && c.analysis)
        .sort(newestFirst)[0];
      return { client, daysSince: daysSince(last?.startedAt ?? null, now) };
    })
    .filter((q) => q.daysSince === null || q.daysSince > QUIET_DAYS)
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity) || a.client.name.localeCompare(b.client.name));
  return { lowest, negative, quietClients };
}

// Portfolio heatmap ---------------------------------------------------------------------------

export interface HeatmapRow {
  client: ClientRow;
  cells: WeekCell[];
  average: number | null;
}

/** Clients x ISO weeks; clients with calls in the weeks shown, lowest average first, no-data rows last. */
export function portfolioHeatmap(clients: ClientRow[], calls: CallRow[], weeks: Week[]): HeatmapRow[] {
  const first = weeks[0]?.start ?? 0;
  const last = (weeks.at(-1)?.start ?? 0) + WEEK_MS;
  return clients
    .map((client) => {
      const own = calls.filter((c) => {
        const t = toMs(c.startedAt);
        return c.clientId === client.id && t >= first && t < last;
      });
      const scores = own.map(scoreOf).filter((s): s is number => s !== null);
      return { client, cells: weeklyAverages(own, weeks), average: average(scores), hasCalls: own.length > 0 };
    })
    .filter((r) => r.hasCalls)
    .sort(
      (a, b) =>
        (a.average === null ? 1 : 0) - (b.average === null ? 1 : 0) ||
        (a.average ?? 0) - (b.average ?? 0) ||
        a.client.name.localeCompare(b.client.name),
    )
    .map(({ client, cells, average: avg }) => ({ client, cells, average: avg }));
}

// Score timeline ------------------------------------------------------------------------------

export interface TimelinePoint {
  t: number;
  score: number;
  callId: string;
  label: string;
}

export interface TimelineSeries {
  clientId: string;
  name: string;
  points: TimelinePoint[];
}

/** One series per client: scored calls in the period on a real time axis, oldest first. */
export function scoreTimeline(calls: CallRow[], p: Period): TimelineSeries[] {
  const byClient = new Map<string, TimelineSeries>();
  for (const c of callsInPeriod(calls, p)) {
    const score = scoreOf(c);
    if (score === null || !c.clientId) continue;
    const series = byClient.get(c.clientId) ?? { clientId: c.clientId, name: c.clientName, points: [] };
    series.points.push({ t: toMs(c.startedAt), score, callId: c.id, label: stripClientName(c.title, c.clientName) });
    byClient.set(c.clientId, series);
  }
  return [...byClient.values()]
    .map((s) => ({ ...s, points: s.points.sort((a, b) => a.t - b.t) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Topics and emotions -------------------------------------------------------------------------

/** Negative-moment topics with counts, most frequent first. */
export function negativeTopics(calls: CallRow[], limit = 8): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of calls) {
    for (const m of c.analysis?.moments ?? []) {
      if (m.polarity !== "negative") continue;
      const topic = m.topic.trim().toLowerCase();
      if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, limit);
}

export const momentCounts = (moments: MomentLite[]) => ({
  negative: moments.filter((m) => m.polarity === "negative").length,
  positive: moments.filter((m) => m.polarity === "positive").length,
});

export interface EmotionMixRow {
  client: ClientRow;
  positive: number;
  negative: number;
}

/** Positive vs negative moment counts per client, most negative share first. */
export function emotionMix(clients: ClientRow[], calls: CallRow[]): EmotionMixRow[] {
  return clients
    .map((client) => {
      const moments = calls.filter((c) => c.clientId === client.id).flatMap((c) => c.analysis?.moments ?? []);
      return { client, ...momentCounts(moments) };
    })
    .filter((r) => r.positive + r.negative > 0)
    .sort(
      (a, b) =>
        b.negative / (b.negative + b.positive) - a.negative / (a.negative + a.positive) || a.client.name.localeCompare(b.client.name),
    );
}

/** Moments per emotion, most frequent first. */
export function emotionCounts(calls: CallRow[]): { emotion: string; polarity: Polarity; count: number }[] {
  const counts = new Map<string, { emotion: string; polarity: Polarity; count: number }>();
  for (const m of calls.flatMap((c) => c.analysis?.moments ?? [])) {
    const entry = counts.get(m.emotion) ?? { emotion: m.emotion, polarity: m.polarity, count: 0 };
    entry.count++;
    counts.set(m.emotion, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.emotion.localeCompare(b.emotion));
}

// Clients overview ----------------------------------------------------------------------------

export const PROVISIONAL_BELOW = 3;
export const ROLLING_WINDOW = 3;

/** A client score from fewer than 3 analysed calls is provisional. */
export const isProvisional = (scoredCount: number) => scoredCount < PROVISIONAL_BELOW;

export interface ClientOverview {
  client: ClientRow;
  rollingScore: number | null;
  scoredCount: number;
  provisional: boolean;
  latestLabel: SentimentLabel | null;
  coverage: Coverage;
  weekly: WeekCell[];
  daysSinceLastCall: number | null;
  negativeMoments: number;
  attention: number;
}

/**
 * One row per client, most attention needed first. Rolling score = average of the newest 3 scored
 * calls (any date); coverage, sparkline and negative moments use the period.
 */
export function clientOverview(clients: ClientRow[], calls: CallRow[], p: Period, weeks: Week[], now: Date): ClientOverview[] {
  return clients
    .map((client) => {
      const own = calls.filter((c) => c.clientId === client.id).sort(newestFirst);
      const scored = own.filter((c) => scoreOf(c) !== null);
      const rolling = average(scored.slice(0, ROLLING_WINDOW).map((c) => scoreOf(c)!));
      const current = callsInPeriod(own, p);
      const negativeMoments = current.reduce((n, c) => n + momentCounts(c.analysis?.moments ?? []).negative, 0);
      const latestLabel = own.find((c) => c.analysis)?.analysis?.label ?? null;
      const last = daysSince(own[0]?.startedAt ?? null, now);
      const attention =
        (latestLabel === "unhappy" ? 4 : 0) +
        (rolling === null ? 0 : rolling <= 4 ? 3 : rolling <= 6 ? 1 : 0) +
        Math.min(negativeMoments, 6) * 0.5 +
        (last === null || last > QUIET_DAYS ? 1 : 0);
      return {
        client,
        rollingScore: rolling,
        scoredCount: scored.length,
        provisional: isProvisional(scored.length),
        latestLabel,
        coverage: coverage(current),
        weekly: weeklyAverages(current, weeks),
        daysSinceLastCall: last,
        negativeMoments,
        attention,
      };
    })
    .sort(
      (a, b) =>
        b.attention - a.attention ||
        (a.rollingScore ?? 11) - (b.rollingScore ?? 11) ||
        a.client.name.localeCompare(b.client.name),
    );
}

// Calls table ---------------------------------------------------------------------------------

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAME_MARK = "\u0000";
const isSeparator = (token: string) => /^(?:[-–—|:,&+/<>×]+|x)$/i.test(token);

/**
 * Title without the client's name and the separators next to it:
 * "Acme x E2M Weekly" -> "E2M Weekly", "E2M <> Acme strategy session" -> "E2M strategy session".
 */
export function stripClientName(title: string | null, clientName: string): string {
  const original = title?.trim();
  if (!original) return "Untitled call";
  const name = clientName.trim();
  if (!name) return original;
  const marked = original.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "giu"), ` ${NAME_MARK} `);
  const out: string[] = [];
  let afterName = false;
  for (const token of marked.split(/\s+/).filter(Boolean)) {
    if (token === NAME_MARK) {
      while (out.length && isSeparator(out.at(-1)!)) out.pop();
      afterName = true;
    } else if (isSeparator(token) && (afterName || out.length === 0 || isSeparator(out.at(-1)!))) {
      continue;
    } else {
      out.push(token);
      afterName = false;
    }
  }
  while (out.length && isSeparator(out.at(-1)!)) out.pop();
  const stripped = out.join(" ");
  return stripped ? capitalise(stripped) : original;
}

export type CallSortKey = "date" | "client" | "duration" | "score";
export type SortDir = "asc" | "desc";

/** Sorted copy; missing values always last. */
export function sortCalls(calls: CallRow[], key: CallSortKey, dir: SortDir): CallRow[] {
  const value = (c: CallRow): number | string | null => {
    switch (key) {
      case "date":
        return Number.isNaN(toMs(c.startedAt)) ? null : toMs(c.startedAt);
      case "client":
        return c.clientName.toLowerCase();
      case "duration":
        return c.durationSeconds;
      case "score":
        return scoreOf(c);
    }
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...calls].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    if (x < y) return -sign;
    if (x > y) return sign;
    return 0;
  });
}

export const PAGE_SIZE = 25;

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { items: items.slice(current * size, (current + 1) * size), page: current, pages };
}

// Call emotion timeline -----------------------------------------------------------------------

/** Horizontal position (0-100%) of a moment on the call's timeline. */
export function timelinePosition(timestampSeconds: number | null, lengthSeconds: number): number | null {
  if (timestampSeconds === null || !Number.isFinite(timestampSeconds) || lengthSeconds <= 0) return null;
  return Math.min(100, Math.max(0, (timestampSeconds / lengthSeconds) * 100));
}

/** Timeline length: the call duration, stretched if a moment or segment runs past it. */
export function timelineLength(durationSeconds: number | null, timestamps: (number | null)[]): number {
  const latest = Math.max(0, ...timestamps.filter((t): t is number => t !== null && Number.isFinite(t)));
  return Math.max(durationSeconds ?? 0, latest, 60);
}

/** Moments grouped negative, then positive, then neutral; each by timestamp. */
export function groupMoments<T extends { polarity: Polarity; timestampSeconds: number | null }>(
  moments: T[],
): { polarity: Polarity; moments: T[] }[] {
  const order: Polarity[] = ["negative", "positive", "neutral"];
  return order
    .map((polarity) => ({
      polarity,
      moments: moments
        .filter((m) => m.polarity === polarity)
        .sort((a, b) => (a.timestampSeconds ?? Infinity) - (b.timestampSeconds ?? Infinity)),
    }))
    .filter((g) => g.moments.length > 0);
}
