/**
 * Fake data for previews (NEXT_PUBLIC_USE_FIXTURES=true or no Supabase env) and tests.
 * Every name, title and line of dialogue here is invented.
 */
import type {
  AnalysisDetail,
  CallDetail,
  CallRow,
  ClientRow,
  Moment,
  Profile,
  Segment,
  SentimentLabel,
  SettingsData,
} from "./model";

const DAY_MS = 24 * 60 * 60 * 1000;

export const FIXTURE_PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Preview Admin",
  email: "preview@example.com",
  role: "admin",
  active: true,
};

export const FIXTURE_CLIENTS: ClientRow[] = [
  { id: "c0000000-0000-4000-8000-000000000001", name: "Northwind Studio", status: "active" },
  { id: "c0000000-0000-4000-8000-000000000002", name: "Blue Harbor Media", status: "active" },
  { id: "c0000000-0000-4000-8000-000000000003", name: "Acme Growth Agency", status: "active" },
];

const [northwind, blueHarbor, acme] = FIXTURE_CLIENTS as [ClientRow, ClientRow, ClientRow];

interface Spec {
  client: ClientRow;
  daysAgo: number;
  title: string;
  minutes: number;
  score: number | null;
  label: SentimentLabel | null;
  negatives?: [string, number][];
  positives?: [string, number][];
  manual?: boolean;
  status?: CallRow["status"];
  error?: string;
  analysed?: boolean;
}

const SPECS: Spec[] = [
  { client: northwind, daysAgo: 1, title: "Weekly sync", minutes: 34, score: 3, label: "unhappy", negatives: [["delivery delays", 3], ["reporting gaps", 2]] },
  { client: blueHarbor, daysAgo: 2, title: "Campaign review", minutes: 41, score: 8, label: "happy", positives: [["new landing pages", 2], ["fast turnaround", 1]] },
  { client: acme, daysAgo: 3, title: "Onboarding call", minutes: 52, score: 6, label: "neutral", negatives: [["CRM access", 1]], positives: [["kickoff plan", 1]] },
  { client: northwind, daysAgo: 6, title: "Escalation follow-up", minutes: 28, score: 5, label: "neutral", negatives: [["delivery delays", 2]] },
  { client: blueHarbor, daysAgo: 8, title: "Monthly report", minutes: 25, score: 9, label: "happy", positives: [["traffic growth", 3]] },
  { client: acme, daysAgo: 9, title: "Strategy session", minutes: 60, score: 7, label: "happy", negatives: [["budget pressure", 3]], positives: [["automation demo", 2]] },
  { client: northwind, daysAgo: 13, title: "Weekly sync", minutes: 30, score: 6, label: "neutral" },
  { client: blueHarbor, daysAgo: 15, title: "Quick check-in", minutes: 12, score: 6, label: "neutral" },
  { client: northwind, daysAgo: 20, title: "Weekly sync", minutes: 31, score: 7, label: "happy", positives: [["design refresh", 2]] },
  { client: acme, daysAgo: 22, title: "Quarterly planning", minutes: 48, score: 8, label: "happy", positives: [["roadmap clarity", 2]] },
  { client: northwind, daysAgo: 40, title: "Weekly sync", minutes: 29, score: 8, label: "happy" },
  { client: blueHarbor, daysAgo: 4, title: "Partner call", minutes: 37, score: null, label: null, manual: true, analysed: false, status: "not_started" },
  { client: acme, daysAgo: 5, title: "Leadership call", minutes: 44, score: null, label: null, manual: true, analysed: false, status: "failed", error: "OpenRouter 503: provider overloaded" },
  { client: northwind, daysAgo: 0, title: "Status call", minutes: 22, score: null, label: null, manual: true, analysed: false, status: "running" },
];

const pad = (n: number) => String(n).padStart(12, "0");

const NEGATIVE_EMOTIONS = ["frustrated", "concerned", "disappointed", "impatient"];
const POSITIVE_EMOTIONS = ["pleased", "excited", "grateful", "relieved"];

function buildMoments(spec: Spec, callIndex: number): Moment[] {
  const moments: Moment[] = [];
  (spec.negatives ?? []).forEach(([topic, intensity], k) =>
    moments.push({
      id: `m${callIndex}-n${k}`,
      topic,
      emotion: NEGATIVE_EMOTIONS[k % NEGATIVE_EMOTIONS.length]!,
      polarity: "negative",
      intensity,
      quote: `We keep running into ${topic} and it is starting to worry the team.`,
      speaker: "Client Speaker",
      timestampSeconds: 120 + k * 240,
      quoteVerified: k !== 1,
      reasoning: `The client raised ${topic} with a clear change in tone.`,
    }),
  );
  (spec.positives ?? []).forEach(([topic, intensity], k) =>
    moments.push({
      id: `m${callIndex}-p${k}`,
      topic,
      emotion: POSITIVE_EMOTIONS[k % POSITIVE_EMOTIONS.length]!,
      polarity: "positive",
      intensity,
      quote: `Honestly the ${topic} looks really good, the team loved it.`,
      speaker: "Client Speaker",
      timestampSeconds: 600 + k * 300,
      quoteVerified: true,
      reasoning: `Unprompted praise for ${topic}.`,
    }),
  );
  return moments.sort((a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0));
}

function buildTranscript(minutes: number): Segment[] {
  const lines = [
    ["Staff Member", "Thanks for joining, shall we start with the update?"],
    ["Client Speaker", "Sure. We keep running into delivery delays and it is starting to worry the team."],
    ["Staff Member", "Understood, let me walk you through the plan for this week."],
    ["Client Speaker", "Honestly the new landing pages looks really good, the team loved it."],
  ] as const;
  const count = Math.min(400, Math.max(40, minutes * 6));
  return Array.from({ length: count }, (_, i) => {
    const [speakerName, text] = lines[i % lines.length]!;
    return { i, startSeconds: i * 10, speakerName, text };
  });
}

function build(now: number) {
  const calls: CallRow[] = [];
  const details = new Map<string, CallDetail>();
  SPECS.forEach((spec, index) => {
    const id = `a0000000-0000-4000-8000-${pad(index + 1)}`;
    const startedAt = new Date(now - spec.daysAgo * DAY_MS - 3 * 60 * 60 * 1000).toISOString();
    const moments = spec.analysed === false ? [] : buildMoments(spec, index);
    const detail: AnalysisDetail | null =
      spec.analysed === false
        ? null
        : {
            id: `b0000000-0000-4000-8000-${pad(index + 1)}`,
            score: spec.score,
            label: spec.label,
            summary: "The client started guarded, raised their main concerns, and ended the call in a calmer mood.",
            scoreReasoning: "The score reflects the balance of concerns raised and the tone at the close of the call.",
            triggerSource: index % 4 === 0 ? "manual" : "auto",
            createdAt: new Date(new Date(startedAt).getTime() + 2 * 60 * 60 * 1000).toISOString(),
            dropped: { non_client: moments.length ? 1 : 6, duplicate: 0 },
            stats: null,
            moments,
          };
    const call: CallRow = {
      id,
      title: spec.title,
      startedAt,
      durationSeconds: spec.minutes * 60,
      clientId: spec.client.id,
      clientName: spec.client.name,
      requiresManual: spec.manual ?? false,
      manualReason: spec.manual ? "Leadership attendee" : null,
      status: spec.status ?? "done",
      error: spec.error ?? null,
      analysis: detail && {
        id: detail.id,
        score: detail.score,
        label: detail.label,
        triggerSource: detail.triggerSource,
        createdAt: detail.createdAt,
        moments: detail.moments.map((m) => ({ polarity: m.polarity, intensity: m.intensity, topic: m.topic })),
      },
    };
    calls.push(call);
    details.set(id, { call, analysis: detail, segments: buildTranscript(spec.minutes) });
  });

  const lowEvidence = calls[6]!;
  const lowDetail = details.get(lowEvidence.id)!;
  lowDetail.analysis = { ...lowDetail.analysis!, moments: [], dropped: { non_client: 7, duplicate: 0 } };
  lowEvidence.analysis = { ...lowEvidence.analysis!, moments: [] };

  return { calls, details };
}

export function fixtureData(now = Date.now()) {
  return build(now);
}

export const FIXTURE_SETTINGS: SettingsData = {
  settings: [
    { key: "e2m_domains", value: ["example-staff.com"] },
    { key: "analysis_policy", value: { manual_only_if_attendee_emails: ["leader@example-staff.com"] } },
    { key: "call_duration_limits", value: { min_minutes: 5, max_minutes: 240 } },
  ],
  prompt: { name: "sentiment", version: 2, model: "openai/gpt-4o-mini", createdAt: new Date(0).toISOString() },
};
