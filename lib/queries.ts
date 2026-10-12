/**
 * All data access. Every function takes the server client from getDb(), or null for fixtures,
 * and returns the app's own types (lib/model.ts). Reads go through RLS as the signed-in user.
 */
import { toCallPeople } from "./access";
import { manualReasonLabel } from "./analytics";
import { FIXTURE_ROLE, USE_FIXTURES } from "./env";
import {
  FIXTURE_MEMBER_ACCOUNTS,
  FIXTURE_MEMBERS,
  FIXTURE_SETTINGS,
  FIXTURE_USER_CHANGES,
  fixtureCallPeople,
  fixtureData,
  fixtureScope,
  fixtureViewer,
} from "./fixtures";
import type {
  AnalysisDetail,
  AnalysisStats,
  CallDetail,
  CallPeople,
  CallRow,
  ClientRow,
  DroppedCounts,
  FathomAccount,
  Member,
  MemberAccount,
  Moment,
  Segment,
  SettingsData,
  SyncResult,
  UserChange,
} from "./model";
import type { AnalysisStatus, Polarity, SentimentLabel } from "./database.types";
import { meetingPeople } from "./sentiment";
import type { Db } from "./supabase/server";

const MAX_CALLS = 2000;

const CALL_COLUMNS =
  "id, title, started_at, duration_seconds, client_id, requires_manual_analysis, manual_reason, " +
  "analysis_status, analysis_error, master_recording_id, attendee_emails, clients(name), " +
  "analyses(id, sentiment_score, overall_sentiment, trigger_source, created_at, sentiment_moments(polarity, intensity, topic, emotion))";

interface RawCall {
  id: string;
  title: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  client_id: string | null;
  requires_manual_analysis: boolean;
  manual_reason: string | null;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  master_recording_id: string | null;
  attendee_emails: string[] | null;
  clients: { name: string } | null;
  analyses: {
    id: string;
    sentiment_score: number | null;
    overall_sentiment: SentimentLabel | null;
    trigger_source: "auto" | "manual";
    created_at: string;
    sentiment_moments: { polarity: Polarity; intensity: number; topic: string; emotion: string }[];
  }[];
}

export class QueryError extends Error {}

/** Fixture data only in fixture mode; without Supabase env and without the flag, fail loudly. */
function fixture<T>(make: () => T): T {
  if (!USE_FIXTURES) throw new QueryError("Supabase is not configured. Set the variables in .env.local.");
  return make();
}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new QueryError(`Could not load ${what}: ${result.error.message}`);
  return result.data as T;
}

/** analysis_policy.manual_only_if_attendee_emails, used to name the attendee behind a manual-only call. */
async function loadManualOnlyEmails(db: Db): Promise<string[]> {
  const result = await db.from("app_settings").select("value").eq("key", "analysis_policy").maybeSingle();
  const value = asObject<{ manual_only_if_attendee_emails?: unknown }>(check(result, "settings")?.value);
  const emails = value?.manual_only_if_attendee_emails;
  return Array.isArray(emails) ? emails.filter((e): e is string => typeof e === "string") : [];
}

function toCallRow(raw: RawCall, manualOnlyEmails: string[]): CallRow {
  const a = raw.analyses[0];
  return {
    id: raw.id,
    title: raw.title,
    startedAt: raw.started_at,
    durationSeconds: raw.duration_seconds,
    clientId: raw.client_id,
    clientName: raw.clients?.name ?? "Unknown client",
    requiresManual: raw.requires_manual_analysis,
    manualReason: raw.manual_reason,
    manualLabel: raw.requires_manual_analysis
      ? manualReasonLabel(raw.manual_reason, raw.attendee_emails ?? [], manualOnlyEmails)
      : null,
    status: raw.analysis_status,
    error: raw.analysis_error,
    analysis: a
      ? {
          id: a.id,
          score: a.sentiment_score,
          label: a.overall_sentiment,
          triggerSource: a.trigger_source,
          createdAt: a.created_at,
          moments: a.sentiment_moments,
        }
      : null,
  };
}

/** Client calls (not excluded) with their current analysis, newest first. */
export async function getCallRows(db: Db | null): Promise<CallRow[]> {
  if (!db) return fixture(() => fixtureScope(FIXTURE_ROLE).calls);
  const [result, manualOnlyEmails] = await Promise.all([
    db
      .from("calls")
      .select(CALL_COLUMNS)
      .eq("call_type", "client")
      .eq("excluded", false)
      .eq("analyses.is_current", true)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(MAX_CALLS),
    loadManualOnlyEmails(db),
  ]);
  return check(result as unknown as { data: RawCall[] | null; error: { message: string } | null }, "calls").map((raw) =>
    toCallRow(raw, manualOnlyEmails),
  );
}

/** The signed-in user's Fathom account (RLS lets owners read their own row), or null if never connected. */
export async function getFathomAccount(db: Db | null, userId: string): Promise<FathomAccount | null> {
  if (!db) return fixture(() => fixtureViewer(FIXTURE_ROLE).account);
  const result = await db
    .from("fathom_accounts")
    .select("vault_secret_id, key_last4, sync_status, last_sync_at, last_sync_error, last_sync_result")
    .eq("owner_id", userId)
    .maybeSingle();
  const row = check(result, "your Fathom account");
  if (!row) return null;
  return {
    connected: row.vault_secret_id !== null,
    keyLast4: row.key_last4,
    syncStatus: row.sync_status,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
    lastSyncResult: asObject<SyncResult>(row.last_sync_result),
  };
}

export async function getClients(db: Db | null): Promise<ClientRow[]> {
  if (!db) return fixture(() => fixtureScope(FIXTURE_ROLE).clients);
  const result = await db.from("clients").select("id, name, status").order("name");
  return check(result, "clients");
}

export async function getClient(db: Db | null, id: string): Promise<ClientRow | null> {
  if (!db) return fixture(() => fixtureScope(FIXTURE_ROLE).clients.find((c) => c.id === id) ?? null);
  const result = await db.from("clients").select("id, name, status").eq("id", id).maybeSingle();
  return check(result, "client");
}

interface RawSegment {
  i?: number;
  start_seconds?: number | null;
  speaker_name?: string | null;
  text?: string;
}

/** Transcript segments without speaker emails. */
export function toSegments(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawSegment[]).map((s, index) => ({
    i: typeof s.i === "number" ? s.i : index,
    startSeconds: typeof s.start_seconds === "number" ? s.start_seconds : null,
    speakerName: s.speaker_name ?? null,
    text: s.text ?? "",
  }));
}

const asObject = <T>(value: unknown): T | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;

export async function getCallDetail(db: Db | null, id: string): Promise<CallDetail | null> {
  if (!db) return fixture(() => fixtureScope(FIXTURE_ROLE).details.get(id) ?? null);

  const [callResult, manualOnlyEmails] = await Promise.all([
    db.from("calls").select(CALL_COLUMNS).eq("id", id).eq("call_type", "client").eq("analyses.is_current", true).maybeSingle(),
    loadManualOnlyEmails(db),
  ]);
  const raw = check(callResult as unknown as { data: RawCall | null; error: { message: string } | null }, "call");
  if (!raw) return null;
  const call = toCallRow(raw, manualOnlyEmails);

  let analysis: AnalysisDetail | null = null;
  if (call.analysis) {
    const [analysisResult, momentsResult] = await Promise.all([
      db
        .from("analyses")
        .select("id, sentiment_score, overall_sentiment, summary, score_reasoning, trigger_source, created_at, dropped:raw_output->dropped, stats:raw_output->stats")
        .eq("id", call.analysis.id)
        .maybeSingle(),
      db
        .from("sentiment_moments")
        .select("id, topic, emotion, polarity, intensity, quote, speaker, timestamp_seconds, quote_verified, reasoning")
        .eq("analysis_id", call.analysis.id)
        .order("timestamp_seconds", { ascending: true, nullsFirst: false }),
    ]);
    const a = check(
      analysisResult as unknown as {
        data: {
          id: string;
          sentiment_score: number | null;
          overall_sentiment: SentimentLabel | null;
          summary: string | null;
          score_reasoning: string | null;
          trigger_source: "auto" | "manual";
          created_at: string;
          dropped: unknown;
          stats: unknown;
        } | null;
        error: { message: string } | null;
      },
      "analysis",
    );
    const moments = check(momentsResult, "moments").map(
      (m): Moment => ({
        id: m.id,
        topic: m.topic,
        emotion: m.emotion,
        polarity: m.polarity,
        intensity: m.intensity,
        quote: m.quote,
        speaker: m.speaker,
        timestampSeconds: m.timestamp_seconds,
        quoteVerified: m.quote_verified,
        reasoning: m.reasoning,
      }),
    );
    if (a) {
      analysis = {
        id: a.id,
        score: a.sentiment_score,
        label: a.overall_sentiment,
        summary: a.summary,
        scoreReasoning: a.score_reasoning,
        triggerSource: a.trigger_source,
        createdAt: a.created_at,
        dropped: asObject<DroppedCounts>(a.dropped),
        stats: asObject<AnalysisStats>(a.stats),
        moments,
      };
    }
  }

  const recordingFilter = raw.master_recording_id
    ? `call_id.eq.${raw.id},id.eq.${raw.master_recording_id}`
    : `call_id.eq.${raw.id}`;
  const [transcript, recordings, domains] = await Promise.all([
    raw.master_recording_id
      ? db.from("recording_transcripts").select("segments").eq("recording_id", raw.master_recording_id).maybeSingle()
      : null,
    db.from("recordings").select("invitees, recorded_by_name, recorded_by_email").or(recordingFilter),
    db.from("app_settings").select("value").eq("key", "e2m_domains").maybeSingle(),
  ]);
  const segments = transcript ? toSegments(check(transcript, "transcript")?.segments) : [];
  const e2mDomains = check(domains, "settings")?.value;
  const people = meetingPeople(
    check(recordings, "attendees").map((r) => ({
      invitees: r.invitees,
      recordedByName: r.recorded_by_name,
      recordedByEmail: r.recorded_by_email,
    })),
    Array.isArray(e2mDomains) ? e2mDomains.filter((d): d is string => typeof d === "string") : [],
    segments.map((s) => s.speakerName),
  );

  return { call, analysis, segments, people };
}

export async function getSettings(db: Db | null): Promise<SettingsData> {
  if (!db) return fixture(() => FIXTURE_SETTINGS);
  const [settings, prompt] = await Promise.all([
    db.from("app_settings").select("key, value").order("key"),
    db
      .from("prompt_versions")
      .select("name, version, model, created_at")
      .eq("name", "sentiment")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const p = check(prompt, "prompt version");
  return {
    settings: check(settings, "settings"),
    prompt: p ? { name: p.name, version: p.version, model: p.model, createdAt: p.created_at } : null,
  };
}

// Admin only (RLS returns just the caller's own rows to everyone else) -------------------------

interface RawProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: Member["role"];
  active: boolean;
  job_title?: string | null;
  created_at?: string | null;
}

/** Selected with * so the app keeps working before the job_title migration is applied. */
export const toProfile = (row: RawProfile) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  active: row.active,
  jobTitle: row.job_title ?? null,
});

export async function getMembers(db: Db | null): Promise<Member[]> {
  if (!db) return fixture(() => FIXTURE_MEMBERS);
  const result = await db.from("profiles").select("*").order("full_name", { ascending: true, nullsFirst: false });
  return (check(result, "users") as RawProfile[]).map((row) => ({ ...toProfile(row), createdAt: row.created_at ?? null }));
}

/** Which member each call belongs to (their Fathom key synced it, or they were invited). */
export async function getCallPeople(db: Db | null): Promise<CallPeople> {
  if (!db) return fixture(() => fixtureCallPeople(fixtureData().calls));
  const result = await db.rpc("admin_call_people");
  return toCallPeople(check(result, "call owners") ?? []);
}

export async function getMemberAccounts(db: Db | null): Promise<MemberAccount[]> {
  if (!db) return fixture(() => FIXTURE_MEMBER_ACCOUNTS);
  const result = await db
    .from("fathom_accounts")
    .select("owner_id, vault_secret_id, sync_status, last_sync_at")
    .not("owner_id", "is", null);
  return check(result, "Fathom connections").map((a) => ({
    ownerId: a.owner_id!,
    connected: a.vault_secret_id !== null,
    syncStatus: a.sync_status,
    lastSyncAt: a.last_sync_at,
  }));
}

const USER_ACTIONS = ["user_role_changed", "user_title_changed", "user_deactivated", "user_reactivated"] as const;

export async function getUserChanges(db: Db | null, limit = 15): Promise<UserChange[]> {
  if (!db) return fixture(() => FIXTURE_USER_CHANGES);
  const result = await db
    .from("audit_log")
    .select("id, created_at, user_id, entity_id, action, details")
    .in("action", [...USER_ACTIONS])
    .order("id", { ascending: false })
    .limit(limit);
  return check(result, "user changes").map((row) => {
    const details = asObject<{ from?: unknown; to?: unknown }>(row.details);
    const text = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      id: row.id,
      at: row.created_at,
      actorId: row.user_id,
      targetId: row.entity_id,
      action: row.action as UserChange["action"],
      from: text(details?.from),
      to: text(details?.to),
    };
  });
}
