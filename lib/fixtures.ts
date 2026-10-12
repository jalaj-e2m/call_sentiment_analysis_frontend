/**
 * Fake data for previews (only with NEXT_PUBLIC_USE_FIXTURES=true and no Supabase env) and tests.
 * Every name, title, address and line of dialogue here is invented. Generated from a fixed seed,
 * relative to `now`: 8 clients over 12 weeks, scores 2-10, every emotion, and the edge cases each
 * screen has to handle (manual-only, failed, running, low evidence, a quiet client).
 */
import { manualReasonLabel } from "./analytics";
import type {
  AnalysisDetail,
  CallDetail,
  CallRow,
  ClientRow,
  FathomAccount,
  Moment,
  Person,
  Polarity,
  Profile,
  Segment,
  SentimentLabel,
  SettingsData,
} from "./model";
import { meetingPeople } from "./sentiment";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 12;

export const FIXTURE_PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Preview Admin",
  email: "preview@example.com",
  role: "admin",
  active: true,
};

const clientId = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const FIXTURE_CLIENTS: ClientRow[] = [
  "Northwind Studio",
  "Blue Harbor Media",
  "Acme Growth Agency",
  "Lumen Dental Group",
  "Cedar & Pine Realty",
  "Brightpath Learning",
  "Orbit Fitness Co",
  "Quiet Pines Resort",
].map((name, i) => ({ id: clientId(i + 1), name, status: "active" }));

/** Mood over the 12 weeks (start -> end score), call cadence in days, and days since the last call. */
const PROFILES: { from: number; to: number; every: number; lastDaysAgo: number; calls?: number }[] = [
  { from: 7, to: 3, every: 7, lastDaysAgo: 1 }, // Northwind: sliding, needs attention
  { from: 8, to: 9, every: 7, lastDaysAgo: 2 }, // Blue Harbor: steady and happy
  { from: 6, to: 7, every: 10, lastDaysAgo: 3 }, // Acme: mixed
  { from: 3, to: 8, every: 7, lastDaysAgo: 4 }, // Lumen: recovering
  { from: 5, to: 6, every: 14, lastDaysAgo: 6 }, // Cedar & Pine: neutral, sparse
  { from: 8, to: 10, every: 9, lastDaysAgo: 8 }, // Brightpath: delighted
  { from: 5, to: 4, every: 6, lastDaysAgo: 1 }, // Orbit: volatile
  { from: 7, to: 6, every: 30, lastDaysAgo: 30, calls: 2 }, // Quiet Pines: quiet and provisional
];

export const FIXTURE_MANUAL_ONLY_EMAILS = ["leader@example-staff.com"];

const NEGATIVE: Record<string, string[]> = {
  frustrated: ["delivery delays", "missed deadlines"],
  disappointed: ["campaign results", "lead quality"],
  concerned: ["budget pressure", "reporting gaps"],
  confused: ["invoice breakdown", "CRM access"],
  skeptical: ["new strategy", "attribution model"],
  impatient: ["approval turnaround", "website launch"],
};
const POSITIVE: Record<string, string[]> = {
  pleased: ["new landing pages", "weekly reporting"],
  excited: ["automation demo", "rebrand concepts"],
  grateful: ["fast turnaround", "account support"],
  relieved: ["fixed tracking", "launch went live"],
};

/** mulberry32: small deterministic PRNG so fixtures and tests are stable. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bandLabel = (score: number): SentimentLabel => (score <= 4 ? "unhappy" : score <= 6 ? "neutral" : "happy");
const pad = (n: number) => String(n).padStart(12, "0");
const TITLES = [
  (c: string) => `${c} x E2M Weekly Sync`,
  () => "Weekly sync",
  (c: string) => `${c} | Monthly report`,
  (c: string) => `E2M <> ${c} strategy session`,
  () => "Campaign review",
  () => "Quick check-in",
];

interface Draft {
  call: CallRow;
  detail: AnalysisDetail | null;
}

function buildMoments(random: () => number, score: number, durationSeconds: number, callIndex: number, cursor: { n: number }): Moment[] {
  const negatives = score <= 3 ? 3 + Math.floor(random() * 2) : score <= 5 ? 2 : score <= 7 ? Math.floor(random() * 2) : 0;
  const positives = score >= 9 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : Math.floor(random() * 2);
  const specs: { polarity: Polarity; emotion: string; topic: string; intensity: number }[] = [];
  const negKeys = Object.keys(NEGATIVE);
  const posKeys = Object.keys(POSITIVE);
  for (let k = 0; k < negatives; k++) {
    const emotion = negKeys[cursor.n++ % negKeys.length]!;
    const topics = NEGATIVE[emotion]!;
    const intensity = score <= 3 ? 3 - (k % 2) : score <= 5 ? 2 : 1;
    specs.push({ polarity: "negative", emotion, topic: topics[Math.floor(random() * topics.length)]!, intensity });
  }
  for (let k = 0; k < positives; k++) {
    const emotion = posKeys[cursor.n++ % posKeys.length]!;
    const topics = POSITIVE[emotion]!;
    specs.push({ polarity: "positive", emotion, topic: topics[Math.floor(random() * topics.length)]!, intensity: score >= 9 ? 3 : 1 + (k % 2) });
  }
  const total = specs.length;
  return specs
    .map((s, k) => {
      const at = Math.round((durationSeconds * (k + 1)) / (total + 1) + (random() - 0.5) * 60);
      return {
        id: `m${callIndex}-${k}`,
        topic: s.topic,
        emotion: s.emotion,
        polarity: s.polarity,
        intensity: s.intensity,
        quote:
          s.polarity === "negative"
            ? `Honestly the ${s.topic} part keeps coming up for us and it is a worry.`
            : `The ${s.topic} were really good, the team noticed straight away.`,
        speaker: "Client Speaker",
        timestampSeconds: Math.max(5, Math.min(durationSeconds - 5, at)),
        quoteVerified: !(s.polarity === "negative" && k === 1 && callIndex % 3 === 0),
        reasoning:
          s.polarity === "negative"
            ? `The client raised ${s.topic} with a clear change in tone.`
            : `Unprompted praise for ${s.topic}.`,
      };
    })
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

function buildTranscript(durationSeconds: number, moments: Moment[]): Segment[] {
  const lines = [
    ["Staff Member", "Thanks for joining, shall we go through the update?"],
    ["Client Speaker", "Sure, there are a couple of things we wanted to raise this week."],
    ["Staff Member", "Understood, let me walk you through the plan for the next sprint."],
    ["Client Speaker", "That sounds reasonable, can you share the timeline afterwards?"],
  ] as const;
  const step = 15;
  const count = Math.min(400, Math.max(40, Math.floor(durationSeconds / step)));
  const segments: Segment[] = Array.from({ length: count }, (_, i) => {
    const [speakerName, text] = lines[i % lines.length]!;
    return { i, startSeconds: i * step, speakerName, text };
  });
  for (const m of moments) {
    const index = Math.min(count - 1, Math.round((m.timestampSeconds ?? 0) / step));
    segments[index] = { ...segments[index]!, speakerName: "Client Speaker", text: m.quote };
  }
  return segments;
}

function buildPeople(clientName: string, segments: Segment[], manualOnly: boolean): Person[] {
  const domain = `${clientName.toLowerCase().replace(/[^a-z]+/g, "")}.example`;
  return meetingPeople(
    [
      {
        invitees: [
          { name: "Client Speaker", email: `client.speaker@${domain}` },
          { name: "Client Colleague", email: `colleague@${domain}` },
          { name: "Staff Member", email: "staff.member@example-staff.com" },
          ...(manualOnly ? [{ name: "Leader", email: FIXTURE_MANUAL_ONLY_EMAILS[0] }] : []),
        ],
        recordedByName: "Staff Member",
        recordedByEmail: "staff.member@example-staff.com",
      },
    ],
    ["example-staff.com"],
    segments.map((s) => s.speakerName),
  );
}

function makeCall(
  index: number,
  client: ClientRow,
  startedAt: number,
  durationSeconds: number,
  title: string,
  extra: Partial<CallRow> = {},
): CallRow {
  return {
    id: `a0000000-0000-4000-8000-${pad(index + 1)}`,
    title,
    startedAt: new Date(startedAt).toISOString(),
    durationSeconds,
    clientId: client.id,
    clientName: client.name,
    requiresManual: false,
    manualReason: null,
    manualLabel: null,
    status: "done",
    error: null,
    analysis: null,
    ...extra,
  };
}

function build(now: number) {
  const random = rng(20261012);
  const cursor = { n: 0 };
  const drafts: Draft[] = [];

  const analysed = (call: CallRow, score: number | null, moments: Moment[], lowEvidence = false): Draft => {
    const label = score === null ? "neutral" : bandLabel(score);
    const detail: AnalysisDetail = {
      id: call.id.replace(/^a/, "b"),
      score,
      label,
      summary:
        label === "unhappy"
          ? "The client was frustrated about recurring issues and asked for a clear recovery plan."
          : label === "happy"
            ? "The client was positive about recent work and keen to expand the scope."
            : "A practical call: some concerns were raised and addressed, the tone stayed even.",
      scoreReasoning: "The score reflects the balance of concerns raised and the tone at the close of the call.",
      triggerSource: drafts.length % 5 === 0 ? "manual" : "auto",
      createdAt: new Date(Date.parse(call.startedAt!) + 2 * 60 * 60 * 1000).toISOString(),
      dropped: { non_client: lowEvidence ? 7 : 1, duplicate: 0 },
      stats: {
        client_speech_share: lowEvidence ? 0.04 : 0.3 + random() * 0.25,
        moments_proposed: moments.length + (lowEvidence ? 7 : 1),
        moments_kept: moments.length,
      },
      moments,
    };
    return {
      call: {
        ...call,
        analysis: {
          id: detail.id,
          score,
          label,
          triggerSource: detail.triggerSource,
          createdAt: detail.createdAt,
          moments: moments.map((m) => ({ polarity: m.polarity, intensity: m.intensity, topic: m.topic, emotion: m.emotion })),
        },
      },
      detail,
    };
  };

  FIXTURE_CLIENTS.forEach((client, c) => {
    const profile = PROFILES[c]!;
    const first = now - WEEKS * 7 * DAY_MS + c * DAY_MS;
    const last = now - profile.lastDaysAgo * DAY_MS;
    const times: number[] = [];
    for (let t = last; t >= first && times.length < (profile.calls ?? 99); t -= profile.every * DAY_MS) {
      times.unshift(t - Math.floor(random() * 3) * 60 * 60 * 1000);
    }
    times.forEach((t, k) => {
      const progress = times.length > 1 ? k / (times.length - 1) : 1;
      const volatile = c === 6 ? (k % 2 === 0 ? 3 : -2) : 0;
      const noise = Math.round((random() - 0.5) * 2);
      const score = Math.min(10, Math.max(2, Math.round(profile.from + (profile.to - profile.from) * progress) + noise + volatile));
      const duration = (20 + Math.floor(random() * 45)) * 60;
      const call = makeCall(drafts.length, client, t - 3 * 60 * 60 * 1000, duration, TITLES[(c + k) % TITLES.length]!(client.name));
      drafts.push(analysed(call, score, buildMoments(random, score, duration, drafts.length, cursor)));
    });
  });

  // Edge cases, all recent so they show on the default 30-day view.
  const at = (daysAgo: number) => now - daysAgo * DAY_MS - 2 * 60 * 60 * 1000;
  const [northwind, blueHarbor, acme, lumen, cedar, brightpath, orbit] = FIXTURE_CLIENTS as ClientRow[];
  const manualOnly = (reason: string | null) => ({
    requiresManual: true,
    manualReason: reason,
    manualLabel: manualReasonLabel(reason, FIXTURE_MANUAL_ONLY_EMAILS, FIXTURE_MANUAL_ONLY_EMAILS),
  });
  const extras: Draft[] = [
    { call: makeCall(drafts.length, blueHarbor!, at(4), 37 * 60, "Partner call", { ...manualOnly("attendee_requires_manual"), status: "not_started" }), detail: null },
    {
      call: makeCall(drafts.length + 1, acme!, at(5), 44 * 60, "Acme Growth Agency leadership call", {
        ...manualOnly("attendee_requires_manual"),
        status: "failed",
        error: "OpenRouter 503: provider overloaded",
      }),
      detail: null,
    },
    { call: makeCall(drafts.length + 2, northwind!, at(0), 22 * 60, "Status call", { ...manualOnly("attendee_requires_manual"), status: "running" }), detail: null },
    { call: makeCall(drafts.length + 3, cedar!, at(2), 31 * 60, "Budget check-in", { status: "not_started" }), detail: null },
    { call: makeCall(drafts.length + 4, orbit!, at(9), 58 * 60, "Orbit Fitness Co annual review", { ...manualOnly(null), status: "not_started" }), detail: null },
    { call: makeCall(drafts.length + 5, brightpath!, at(3), 27 * 60, "Content planning", { status: "failed", error: "Model output was not valid JSON" }), detail: null },
  ];
  drafts.push(...extras);
  const lowEvidence = makeCall(drafts.length, lumen!, at(6), 19 * 60, "Lumen Dental Group x E2M sync");
  drafts.push(analysed(lowEvidence, null, [], true));

  const calls: CallRow[] = [];
  const details = new Map<string, CallDetail>();
  for (const d of drafts.sort((a, b) => Date.parse(b.call.startedAt!) - Date.parse(a.call.startedAt!))) {
    calls.push(d.call);
    const segments = buildTranscript(d.call.durationSeconds ?? 1800, d.detail?.moments ?? []);
    details.set(d.call.id, {
      call: d.call,
      analysis: d.detail,
      segments,
      people: buildPeople(d.call.clientName, segments, d.call.manualReason === "attendee_requires_manual"),
    });
  }
  return { calls, details };
}

let cache: { minute: number; data: ReturnType<typeof build> } | null = null;

export function fixtureData(now = Date.now()) {
  const minute = Math.floor(now / 60_000);
  if (cache?.minute !== minute) cache = { minute, data: build(minute * 60_000) };
  return cache.data;
}

export const FIXTURE_FATHOM_ACCOUNT: FathomAccount = {
  connected: true,
  keyLast4: "a1b2",
  syncStatus: "idle",
  lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  lastSyncError: null,
  lastSyncResult: { fetched: 6, new_calls: 2, manual_only: 1, skipped: 3, matched: 2, failed: 0, rejected: { internal_no_external_attendees: 1 } },
};

export const FIXTURE_SETTINGS: SettingsData = {
  settings: [
    { key: "analysis_policy", value: { manual_only_if_attendee_emails: FIXTURE_MANUAL_ONLY_EMAILS } },
    { key: "call_duration_limits", value: { min_minutes: 1, max_minutes: 480 } },
    {
      key: "classification_rules",
      value: { exclude_title_keywords: ["interview", "standup", "1:1"], client_title_keywords: ["client", "review", "sync"] },
    },
    { key: "dedupe", value: { window_minutes: 10, min_attendee_overlap: 0.5 } },
    { key: "e2m_domains", value: ["example-staff.com", "example-staff.solutions"] },
    { key: "public_email_domains", value: ["gmail.com", "yahoo.com", "outlook.com"] },
  ],
  prompt: { name: "sentiment", version: 2, model: "openai/gpt-4o-mini", createdAt: new Date(0).toISOString() },
};
