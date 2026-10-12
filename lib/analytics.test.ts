import { describe, expect, it } from "vitest";
import {
  attentionCalls,
  awaitingManual,
  clientOverview,
  coverage,
  emotionCounts,
  emotionMix,
  firstNameFromEmail,
  groupMoments,
  isoWeek,
  isProvisional,
  manualReasonLabel,
  negativeTopics,
  paginate,
  parseRange,
  periodFor,
  periodKpis,
  periodWeeks,
  rangeHref,
  portfolioHeatmap,
  scoreBand,
  scoreTimeline,
  sortCalls,
  stripClientName,
  timelineLength,
  timelinePosition,
  watchlist,
  weeklyAverages,
} from "./analytics";
import { FIXTURE_CLIENTS, fixtureData } from "./fixtures";
import type { CallRow, ClientRow, MomentLite, SentimentLabel } from "./model";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-12T12:00:00Z"); // a Monday
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const A: ClientRow = { id: "a", name: "Acme", status: "active" };
const B: ClientRow = { id: "b", name: "Beta Co", status: "active" };
const C: ClientRow = { id: "c", name: "Cedar", status: "active" };

let seq = 0;
function call(client: ClientRow, daysAgo: number, score: number | null, opts: Partial<CallRow> & { moments?: MomentLite[]; label?: SentimentLabel } = {}): CallRow {
  const { moments = [], label, ...rest } = opts;
  seq++;
  return {
    id: `call-${seq}`,
    title: `Call ${seq}`,
    startedAt: ago(daysAgo),
    durationSeconds: 1800,
    clientId: client.id,
    clientName: client.name,
    requiresManual: false,
    manualReason: null,
    manualLabel: null,
    status: "done",
    error: null,
    analysis: { id: `an-${seq}`, score, label: label ?? (score === null ? "neutral" : scoreBand(score)), triggerSource: "auto", createdAt: ago(daysAgo), moments },
    ...rest,
  };
}
const unanalysed = (client: ClientRow, daysAgo: number, opts: Partial<CallRow> = {}) =>
  call(client, daysAgo, null, { analysis: null, status: "not_started", ...opts });
const neg = (topic: string, intensity = 1, emotion = "frustrated"): MomentLite => ({ polarity: "negative", intensity, topic, emotion });
const pos = (topic: string, intensity = 1, emotion = "pleased"): MomentLite => ({ polarity: "positive", intensity, topic, emotion });

describe("range and period", () => {
  it("parses the range from the URL, defaulting to 30 days", () => {
    expect(parseRange("7")).toBe("7");
    expect(parseRange(["90"])).toBe("90");
    expect(parseRange("all")).toBe("all");
    expect(parseRange("365")).toBe("30");
    expect(parseRange(undefined)).toBe("30");
  });

  it("builds the current and previous period", () => {
    const p = periodFor("7", NOW);
    expect(p.end - p.start!).toBe(7 * DAY);
    expect(p.start! - p.previousStart!).toBe(7 * DAY);
    expect(periodFor("all", NOW)).toMatchObject({ start: null, previousStart: null });
  });

  it("keeps a non-default range in links", () => {
    expect(rangeHref("/clients", "30")).toBe("/clients");
    expect(rangeHref("/clients", "7")).toBe("/clients?range=7");
    expect(rangeHref("/calls?client=a", "all")).toBe("/calls?client=a&range=all");
  });
});

describe("score bands", () => {
  it("splits 1-4, 5-6 and 7-10", () => {
    expect([1, 4, 5, 6, 7, 10].map(scoreBand)).toEqual(["unhappy", "unhappy", "neutral", "neutral", "happy", "happy"]);
  });
});

describe("ISO weeks and weekly averages", () => {
  it("starts weeks on Monday UTC and handles the year boundary", () => {
    expect(isoWeek(NOW.getTime()).key).toBe("2026-W42");
    expect(isoWeek(Date.parse("2026-10-18T23:00:00Z")).key).toBe("2026-W42");
    expect(isoWeek(Date.parse("2026-10-19T00:00:00Z")).key).toBe("2026-W43");
    expect(isoWeek(Date.parse("2027-01-01T12:00:00Z")).key).toBe("2026-W53");
    expect(isoWeek(Date.parse("2025-12-29T12:00:00Z")).key).toBe("2026-W01");
    expect(new Date(isoWeek(NOW.getTime()).start).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("averages scored calls per week and leaves empty weeks null", () => {
    const p = periodFor("30", NOW);
    const calls = [call(A, 1, 4), call(A, 2, 6), call(B, 9, 8), unanalysed(A, 3), call(A, 10, null)];
    const weeks = periodWeeks(p, calls);
    expect(weeks).toHaveLength(6);
    const cells = weeklyAverages(calls, weeks);
    const byWeek = Object.fromEntries(cells.map((c) => [c.week, c]));
    expect(byWeek["2026-W41"]).toMatchObject({ average: 5, count: 2 });
    expect(byWeek["2026-W40"]).toMatchObject({ average: 8, count: 1 });
    expect(byWeek["2026-W42"]).toMatchObject({ average: null, count: 0 });
  });

  it("caps all-time weeks at 26", () => {
    expect(periodWeeks(periodFor("all", NOW), [call(A, 400, 5)])).toHaveLength(26);
  });
});

describe("coverage and KPIs", () => {
  it("counts analysed of total", () => {
    expect(coverage([call(A, 1, 5), unanalysed(A, 2), call(B, 3, null), unanalysed(B, 4)])).toEqual({ analysed: 2, total: 4, ratio: 0.5 });
    expect(coverage([])).toEqual({ analysed: 0, total: 0, ratio: null });
  });

  it("compares analysed calls with the previous period", () => {
    const p = periodFor("7", NOW);
    const calls = [call(A, 1, 3), call(A, 2, 9), unanalysed(B, 3), call(B, 8, 5), call(B, 9, 5), call(B, 10, 5), call(B, 20, 5)];
    const k = periodKpis(calls, p, periodWeeks(p, calls));
    expect(k).toMatchObject({ analysed: 2, delta: -1, averageScore: 6, unhappy: 1 });
    expect(k.coverage).toEqual({ analysed: 2, total: 3, ratio: 2 / 3 });
    expect(periodKpis(calls, periodFor("all", NOW), []).delta).toBeNull();
  });
});

describe("manual reasons", () => {
  it("names the manual-only attendee by first name", () => {
    expect(firstNameFromEmail("manali.sharma@example.com")).toBe("Manali");
    expect(manualReasonLabel("attendee_requires_manual", ["x@client.example", "Manali.S@Example.com"], ["manali.s@example.com"])).toBe(
      "Manali attended",
    );
    expect(manualReasonLabel("attendee_requires_manual", ["x@client.example"], ["manali.s@example.com"])).toBe("Manual-only attendee");
    expect(manualReasonLabel("long_call", [], [])).toBe("Long call");
    expect(manualReasonLabel(null, [], [])).toBe("Marked for manual analysis");
  });

  it("groups calls awaiting manual analysis by reason", () => {
    const calls = [
      unanalysed(A, 1, { requiresManual: true, manualLabel: "Manali attended" }),
      unanalysed(B, 2, { requiresManual: true, manualLabel: "Manali attended" }),
      unanalysed(B, 3, { requiresManual: true, manualReason: null }),
      call(A, 4, 6, { requiresManual: true, manualLabel: "Manali attended" }),
      unanalysed(A, 5),
    ];
    expect(awaitingManual(calls)).toEqual({
      count: 3,
      reasons: [
        { label: "Manali attended", count: 2 },
        { label: "Marked for manual analysis", count: 1 },
      ],
    });
  });
});

describe("attention and watchlist", () => {
  const p = periodFor("30", NOW);

  it("flags unhappy calls and intensity-3 negatives in the period", () => {
    const calls = [call(A, 1, 3), call(B, 2, 8, { moments: [neg("x", 3)] }), call(B, 3, 8, { moments: [neg("x", 2)] }), call(A, 40, 2)];
    expect(attentionCalls(calls, p).map((c) => c.clientName)).toEqual(["Acme", "Beta Co"]);
  });

  it("lists the lowest 5 scores, intensity >= 2 negatives and quiet clients", () => {
    const calls = [
      ...[9, 3, 7, 5, 8, 6].map((s, i) => call(A, i + 1, s)),
      call(B, 2, 8, { moments: [neg("x", 2)] }),
      call(B, 3, 8, { moments: [neg("x", 1)] }),
      call(C, 25, 6),
    ];
    const w = watchlist(calls, [A, B, C, { id: "d", name: "Dormant", status: "active" }], p, NOW);
    expect(w.lowest.map((c) => c.analysis!.score)).toEqual([3, 5, 6, 6, 7]);
    expect(w.negative).toHaveLength(1);
    expect(w.quietClients.map((q) => [q.client.name, q.daysSince])).toEqual([
      ["Dormant", null],
      ["Cedar", 25],
    ]);
  });
});

describe("portfolio heatmap and timeline", () => {
  it("builds client x week cells, lowest average first, skipping clients without calls", () => {
    const p = periodFor("30", NOW);
    const calls = [call(A, 1, 8), call(A, 2, 6), call(B, 9, 3), call(B, 20, 5)];
    const weeks = periodWeeks(p, calls);
    const rows = portfolioHeatmap([A, B, C], calls, weeks);
    expect(rows.map((r) => r.client.name)).toEqual(["Beta Co", "Acme"]);
    expect(rows[1]!.cells.find((c) => c.week === "2026-W41")).toMatchObject({ average: 7, count: 2 });
    expect(rows[1]!.cells.filter((c) => c.average === null)).toHaveLength(weeks.length - 1);
  });

  it("returns one oldest-first series per client in the period", () => {
    const series = scoreTimeline([call(A, 1, 8), call(A, 5, 4), call(B, 2, 6), call(B, 50, 2), unanalysed(A, 1)], periodFor("30", NOW));
    expect(series.map((s) => [s.name, s.points.map((pt) => pt.score)])).toEqual([
      ["Acme", [4, 8]],
      ["Beta Co", [6]],
    ]);
  });
});

describe("topics and emotions", () => {
  it("counts negative topics case-insensitively, ignoring positives", () => {
    const calls = [
      call(A, 1, 4, { moments: [neg("Delivery delays"), neg("delivery delays "), neg("budget"), pos("delivery delays")] }),
      call(B, 2, 5, { moments: [neg("budget"), neg("access")] }),
    ];
    expect(negativeTopics(calls)).toEqual([
      { topic: "budget", count: 2 },
      { topic: "delivery delays", count: 2 },
      { topic: "access", count: 1 },
    ]);
    expect(negativeTopics(calls, 1)).toHaveLength(1);
  });

  it("mixes positive and negative counts per client, most negative first", () => {
    const calls = [call(A, 1, 8, { moments: [pos("a"), pos("b"), neg("c")] }), call(B, 2, 3, { moments: [neg("d"), neg("e")] }), call(C, 3, 6)];
    expect(emotionMix([A, B, C], calls).map((r) => [r.client.name, r.negative, r.positive])).toEqual([
      ["Beta Co", 2, 0],
      ["Acme", 1, 2],
    ]);
    expect(emotionCounts(calls)[0]).toEqual({ emotion: "frustrated", polarity: "negative", count: 3 });
  });
});

describe("client overview", () => {
  it("marks fewer than 3 analysed calls as provisional", () => {
    expect(isProvisional(0)).toBe(true);
    expect(isProvisional(2)).toBe(true);
    expect(isProvisional(3)).toBe(false);
  });

  it("sorts clients by attention needed", () => {
    const p = periodFor("30", NOW);
    const calls = [
      call(A, 1, 9), call(A, 8, 8), call(A, 15, 9),
      call(B, 2, 3, { moments: [neg("x", 3), neg("y", 2)] }), call(B, 9, 5),
      unanalysed(B, 3),
    ];
    const rows = clientOverview([A, B, C], calls, p, periodWeeks(p, calls), NOW);
    expect(rows.map((r) => r.client.name)).toEqual(["Beta Co", "Cedar", "Acme"]);
    expect(rows[0]).toMatchObject({ rollingScore: 4, scoredCount: 2, provisional: true, negativeMoments: 2, daysSinceLastCall: 2 });
    expect(rows[0]!.coverage).toEqual({ analysed: 2, total: 3, ratio: 2 / 3 });
    expect(rows[2]).toMatchObject({ provisional: false, rollingScore: 26 / 3 });
  });
});

describe("calls table helpers", () => {
  it("strips the client name and the separators next to it", () => {
    expect(stripClientName("Acme x E2M Weekly Sync", "Acme")).toBe("E2M Weekly Sync");
    expect(stripClientName("E2M <> Acme strategy session", "Acme")).toBe("E2M strategy session");
    expect(stripClientName("Cedar & Pine Realty | Monthly report", "Cedar & Pine Realty")).toBe("Monthly report");
    expect(stripClientName("Weekly sync - ACME", "Acme")).toBe("Weekly sync");
    expect(stripClientName("Acmeville kickoff", "Acme")).toBe("Acmeville kickoff");
    expect(stripClientName("Acme", "Acme")).toBe("Acme");
    expect(stripClientName("Acme leadership call", "Acme")).toBe("Leadership call");
    expect(stripClientName(null, "Acme")).toBe("Untitled call");
  });

  it("sorts with missing values last in both directions", () => {
    const calls = [call(A, 3, 5), call(B, 1, null), call(C, 2, 9)];
    expect(sortCalls(calls, "score", "desc").map((c) => c.analysis?.score)).toEqual([9, 5, null]);
    expect(sortCalls(calls, "score", "asc").map((c) => c.analysis?.score)).toEqual([5, 9, null]);
    expect(sortCalls(calls, "date", "desc").map((c) => c.clientName)).toEqual(["Beta Co", "Cedar", "Acme"]);
    expect(sortCalls(calls, "client", "asc").map((c) => c.clientName)).toEqual(["Acme", "Beta Co", "Cedar"]);
  });

  it("paginates 25 per page and clamps the page", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    expect(paginate(items, 0)).toMatchObject({ page: 0, pages: 3 });
    expect(paginate(items, 2).items).toEqual([50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);
    expect(paginate(items, 9).page).toBe(2);
    expect(paginate([], 0)).toEqual({ items: [], page: 0, pages: 1 });
  });
});

describe("call emotion timeline", () => {
  it("positions moments by minute and stretches past the duration", () => {
    expect(timelinePosition(900, 1800)).toBe(50);
    expect(timelinePosition(null, 1800)).toBeNull();
    expect(timelinePosition(2000, 1800)).toBe(100);
    expect(timelineLength(1800, [100, 2400, null])).toBe(2400);
    expect(timelineLength(null, [])).toBe(60);
  });

  it("groups moments negative, then positive, each by time", () => {
    const m = (polarity: "negative" | "positive" | "neutral", t: number | null) => ({ polarity, timestampSeconds: t });
    const groups = groupMoments([m("positive", 50), m("negative", 300), m("negative", 20), m("neutral", 5), m("negative", null)]);
    expect(groups.map((g) => [g.polarity, g.moments.map((x) => x.timestampSeconds)])).toEqual([
      ["negative", [20, 300, null]],
      ["positive", [50]],
      ["neutral", [5]],
    ]);
  });
});

describe("fixtures", () => {
  const { calls, details } = fixtureData(NOW.getTime());

  it("cover 8 clients, 12 weeks, scores 2-10 and every emotion", () => {
    expect(FIXTURE_CLIENTS).toHaveLength(8);
    expect(new Set(calls.map((c) => c.clientId)).size).toBe(8);
    const scores = calls.map((c) => c.analysis?.score).filter((s): s is number => typeof s === "number");
    expect(Math.min(...scores)).toBe(2);
    expect(Math.max(...scores)).toBe(10);
    const oldest = Math.min(...calls.map((c) => Date.parse(c.startedAt!)));
    expect(NOW.getTime() - oldest).toBeGreaterThan(11 * 7 * DAY);
    const emotions = new Set(calls.flatMap((c) => c.analysis?.moments.map((m) => m.emotion) ?? []));
    for (const e of ["frustrated", "disappointed", "concerned", "confused", "skeptical", "impatient", "pleased", "excited", "grateful", "relieved"]) {
      expect(emotions.has(e)).toBe(true);
    }
  });

  it("include the edge cases every screen handles", () => {
    expect(calls.some((c) => c.status === "running")).toBe(true);
    expect(calls.some((c) => c.status === "failed")).toBe(true);
    expect(calls.some((c) => !c.requiresManual && !c.analysis && c.status === "not_started")).toBe(true);
    expect(calls.some((c) => c.analysis && c.analysis.score === null)).toBe(true);
    expect(awaitingManual(calls).reasons.map((r) => r.label)).toContain("Leader attended");
    const p = periodFor("30", NOW);
    expect(watchlist(calls, FIXTURE_CLIENTS, p, NOW).quietClients.map((q) => q.client.name)).toContain("Quiet Pines Resort");
    expect(clientOverview(FIXTURE_CLIENTS, calls, p, [], NOW).some((r) => r.provisional)).toBe(true);
    expect(details.size).toBe(calls.length);
  });
});
