import { describe, expect, it } from "vitest";
import { fixtureData } from "./fixtures";
import type { CallRow, Segment } from "./model";
import {
  canAnalyze,
  canRetry,
  clientSummaries,
  dashboardKpis,
  describeSyncResult,
  findSegmentForMoment,
  formatRelative,
  formatTimestamp,
  isLowEvidence,
  labelStyle,
  meetingPeople,
  needsAttention,
  negativeTopicCounts,
  rollingScore,
  runWithConcurrency,
  scoreTrend,
} from "./sentiment";

const NOW = new Date("2026-06-30T12:00:00Z");

function call(daysAgo: number, score: number | null, extra: Partial<CallRow> = {}): CallRow {
  const startedAt = new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
  return {
    id: `call-${daysAgo}-${score}`,
    title: "Call",
    startedAt,
    durationSeconds: 1800,
    clientId: "client-1",
    clientName: "Client One",
    requiresManual: false,
    manualReason: null,
    status: "done",
    error: null,
    analysis:
      score === null
        ? null
        : {
            id: `analysis-${daysAgo}`,
            score,
            label: score <= 4 ? "unhappy" : score <= 6 ? "neutral" : "happy",
            triggerSource: "auto",
            createdAt: startedAt,
            moments: [],
          },
    ...extra,
  };
}

describe("sentiment badge mapping", () => {
  it("maps each label to its text and colour", () => {
    expect(labelStyle("happy")).toMatchObject({ text: "Happy" });
    expect(labelStyle("happy").className).toContain("emerald");
    expect(labelStyle("neutral").className).toContain("amber");
    expect(labelStyle("unhappy").className).toContain("red");
    expect(labelStyle(null).text).toBe("Not analysed");
  });
});

describe("rolling score", () => {
  it("averages the newest three analysed calls by call date", () => {
    const calls = [call(1, 4), call(10, 8), call(3, 6), call(20, 10), call(2, null)];
    expect(rollingScore(calls)).toBeCloseTo((4 + 6 + 8) / 3);
  });

  it("uses fewer calls when fewer exist, and null when none", () => {
    expect(rollingScore([call(1, 7)])).toBe(7);
    expect(rollingScore([call(1, null)])).toBeNull();
  });

  it("ignores analyses without a score", () => {
    const noScore = call(1, 5);
    noScore.analysis!.score = null;
    expect(rollingScore([noScore, call(2, 9)])).toBe(9);
  });

  it("trend compares the newest three with the three before", () => {
    expect(scoreTrend([call(1, 9), call(2, 9), call(3, 9), call(4, 5), call(5, 5), call(6, 5)])).toBe("up");
    expect(scoreTrend([call(1, 3), call(2, 3), call(3, 3), call(4, 7)])).toBe("down");
    expect(scoreTrend([call(1, 6), call(2, 6), call(3, 6), call(4, 6)])).toBe("flat");
    expect(scoreTrend([call(1, 6), call(2, 6)])).toBeNull();
  });
});

describe("low evidence", () => {
  it("is low with no moments or no score", () => {
    expect(isLowEvidence({ score: 7, moments: [], dropped: null })).toBe(true);
    expect(isLowEvidence({ score: 7, moments: [], dropped: { non_client: 6 } })).toBe(true);
    expect(isLowEvidence({ score: null, moments: [], dropped: null })).toBe(true);
  });

  it("is not low when there are client moments", () => {
    const moment = {
      id: "m",
      topic: "t",
      emotion: "pleased",
      polarity: "positive" as const,
      intensity: 1,
      quote: "q",
      speaker: null,
      timestampSeconds: 1,
      quoteVerified: true,
      reasoning: null,
    };
    expect(isLowEvidence({ score: 7, moments: [moment], dropped: { non_client: 9 } })).toBe(false);
  });
});

describe("moment to transcript matching", () => {
  const segments: Segment[] = [
    { i: 0, startSeconds: 0, speakerName: "A", text: "a" },
    { i: 1, startSeconds: 30, speakerName: "B", text: "b" },
    { i: 2, startSeconds: null, speakerName: "C", text: "c" },
    { i: 5, startSeconds: 90, speakerName: "D", text: "d" },
  ];

  it("picks the segment whose start is closest", () => {
    expect(findSegmentForMoment(segments, 31)).toBe(1);
    expect(findSegmentForMoment(segments, 80)).toBe(5);
    expect(findSegmentForMoment(segments, 500)).toBe(5);
  });

  it("breaks ties towards the earlier segment and skips segments without a start", () => {
    expect(findSegmentForMoment(segments, 15)).toBe(0);
    expect(findSegmentForMoment(segments, 60)).toBe(1);
  });

  it("returns null without a timestamp or segments", () => {
    expect(findSegmentForMoment(segments, null)).toBeNull();
    expect(findSegmentForMoment([], 10)).toBeNull();
  });

  it("formats offsets as mm:ss and h:mm:ss", () => {
    expect(formatTimestamp(65)).toBe("01:05");
    expect(formatTimestamp(3725)).toBe("1:02:05");
    expect(formatTimestamp(null)).toBe("--:--");
  });
});

describe("dashboard aggregations on fixtures", () => {
  const { calls } = fixtureData(NOW.getTime());

  it("computes KPIs for the last 30 days", () => {
    const kpis = dashboardKpis(calls, NOW);
    expect(kpis.analysedRecent).toBe(10);
    expect(kpis.unhappyRecent).toBe(1);
    expect(kpis.awaitingManual).toBe(3);
    expect(kpis.averageScoreRecent).toBeCloseTo(6.5);
  });

  it("lists unhappy calls and calls with an intensity-3 negative moment", () => {
    const attention = needsAttention(calls);
    expect(attention.map((c) => c.title)).toEqual(["Weekly sync", "Strategy session"]);
  });

  it("summarises clients and counts negative topics", () => {
    const summaries = clientSummaries(
      [{ id: calls[0]!.clientId!, name: "Northwind Studio", status: "active" }],
      calls,
      NOW,
    );
    expect(summaries[0]).toMatchObject({ calls: 6, analysed: 5, latestLabel: "unhappy" });
    expect(negativeTopicCounts(calls)[0]).toEqual({ topic: "delivery delays", count: 2 });
  });
});

describe("analyze and retry buttons", () => {
  it("offers Analyze for any unanalysed call, manual-only or not", () => {
    expect(canAnalyze(call(1, null, { requiresManual: true, status: "not_started" }))).toBe(true);
    expect(canAnalyze(call(1, null, { status: "not_started" }))).toBe(true);
  });

  it("hides Analyze while running, after failure, or once analysed", () => {
    expect(canAnalyze(call(1, null, { status: "running" }))).toBe(false);
    expect(canAnalyze(call(1, null, { status: "queued" }))).toBe(false);
    expect(canAnalyze(call(1, 7))).toBe(false);
    const failed = call(1, null, { status: "failed" });
    expect(canAnalyze(failed)).toBe(false);
    expect(canRetry(failed)).toBe(true);
  });
});

describe("meeting people", () => {
  it("merges invitees across recordings, tags sides by E2M domain and lists clients first", () => {
    const people = meetingPeople(
      [
        {
          invitees: [
            { name: "Zed Client", email: "Zed@Client.example" },
            { name: "Amy Staff", email: "amy@e2msolutions.com", is_external: true },
            { name: null, email: "" },
            "not an object",
          ],
          recordedByName: "Amy Staff",
          recordedByEmail: "amy@e2msolutions.com",
        },
        {
          invitees: [{ name: null, email: "zed@client.example" }, { name: "Bo Client", email: "bo@client.example" }],
          recordedByName: "Cy Staff",
          recordedByEmail: "cy@e2m.solutions",
        },
        { invitees: null, recordedByName: null, recordedByEmail: null },
      ],
      ["e2msolutions.com", "e2m.solutions"],
      ["Zed Client", "amy staff", null],
    );
    expect(people).toEqual([
      { name: "Bo Client", email: "bo@client.example", side: "client", recorder: false, spoke: false },
      { name: "Zed Client", email: "zed@client.example", side: "client", recorder: false, spoke: true },
      { name: "Amy Staff", email: "amy@e2msolutions.com", side: "e2m", recorder: true, spoke: true },
      { name: "Cy Staff", email: "cy@e2m.solutions", side: "e2m", recorder: true, spoke: false },
    ]);
  });

  it("returns nobody when there are no recordings", () => {
    expect(meetingPeople([], ["e2msolutions.com"], [])).toEqual([]);
  });
});

describe("Fathom sync helpers", () => {
  it("formats times relative to now", () => {
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(formatRelative(null, NOW)).toBe("never");
    expect(formatRelative("not a date", NOW)).toBe("never");
    expect(formatRelative(ago(20_000), NOW)).toBe("just now");
    expect(formatRelative(ago(5 * 60_000), NOW)).toBe("5 min ago");
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe("3 h ago");
    expect(formatRelative(ago(2 * 86_400_000), NOW)).toBe("2 d ago");
    expect(formatRelative(ago(30 * 86_400_000), NOW)).toBe("31 May 2026");
  });

  it("describes a sync result with counts only", () => {
    expect(describeSyncResult(null)).toBe("No sync yet.");
    expect(describeSyncResult({ new_calls: 0 })).toBe("No new client calls");
    expect(
      describeSyncResult({
        new_calls: 2,
        manual_only: 1,
        skipped: 3,
        importedElsewhere: 1,
        rejected: { internal_no_external_attendees: 2, too_short: 1 },
        failed: 1,
      }),
    ).toBe("2 new client calls (1 manual-only) · 4 already imported · 3 non-client meetings skipped · 1 failed");
    expect(describeSyncResult({ new_calls: 1, rejected: { internal_no_external_attendees: 1 } })).toBe(
      "1 new client call · 1 non-client meeting skipped",
    );
  });

  it("runs work with bounded concurrency and finishes every item", async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      seen.push(n);
      inFlight--;
    });
    expect(peak).toBe(2);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    await expect(runWithConcurrency([], 2, async () => {})).resolves.toBeUndefined();
  });
});
