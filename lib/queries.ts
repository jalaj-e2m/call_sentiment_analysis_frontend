/**
 * All data access. Every function takes the server client from getDb(), or null for fixtures,
 * and returns the app's own types (lib/model.ts). Reads go through RLS as the signed-in user.
 */
import { FIXTURE_CLIENTS, FIXTURE_FATHOM_ACCOUNT, FIXTURE_SETTINGS, fixtureData } from "./fixtures";
import type {
  AnalysisDetail,
  AnalysisStats,
  CallDetail,
  CallRow,
  ClientRow,
  DroppedCounts,
  FathomAccount,
  Moment,
  Segment,
  SettingsData,
  SyncResult,
} from "./model";
import type { AnalysisStatus, Polarity, SentimentLabel } from "./database.types";
import type { Db } from "./supabase/server";

const MAX_CALLS = 2000;

const CALL_COLUMNS =
  "id, title, started_at, duration_seconds, client_id, requires_manual_analysis, manual_reason, " +
  "analysis_status, analysis_error, master_recording_id, clients(name), " +
  "analyses(id, sentiment_score, overall_sentiment, trigger_source, created_at, sentiment_moments(polarity, intensity, topic))";

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
  clients: { name: string } | null;
  analyses: {
    id: string;
    sentiment_score: number | null;
    overall_sentiment: SentimentLabel | null;
    trigger_source: "auto" | "manual";
    created_at: string;
    sentiment_moments: { polarity: Polarity; intensity: number; topic: string }[];
  }[];
}

export class QueryError extends Error {}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new QueryError(`Could not load ${what}: ${result.error.message}`);
  return result.data as T;
}

function toCallRow(raw: RawCall): CallRow {
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
  if (!db) return fixtureData().calls;
  const result = await db
    .from("calls")
    .select(CALL_COLUMNS)
    .eq("call_type", "client")
    .eq("excluded", false)
    .eq("analyses.is_current", true)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(MAX_CALLS);
  return check(result as unknown as { data: RawCall[] | null; error: { message: string } | null }, "calls").map(toCallRow);
}

/** The signed-in user's Fathom account (RLS lets owners read their own row), or null if never connected. */
export async function getFathomAccount(db: Db | null, userId: string): Promise<FathomAccount | null> {
  if (!db) return FIXTURE_FATHOM_ACCOUNT;
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
  if (!db) return FIXTURE_CLIENTS;
  const result = await db.from("clients").select("id, name, status").order("name");
  return check(result, "clients");
}

export async function getClient(db: Db | null, id: string): Promise<ClientRow | null> {
  if (!db) return FIXTURE_CLIENTS.find((c) => c.id === id) ?? null;
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
  if (!db) return fixtureData().details.get(id) ?? null;

  const callResult = await db
    .from("calls")
    .select(CALL_COLUMNS)
    .eq("id", id)
    .eq("call_type", "client")
    .eq("analyses.is_current", true)
    .maybeSingle();
  const raw = check(callResult as unknown as { data: RawCall | null; error: { message: string } | null }, "call");
  if (!raw) return null;
  const call = toCallRow(raw);

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

  let segments: Segment[] = [];
  if (raw.master_recording_id) {
    const transcript = await db
      .from("recording_transcripts")
      .select("segments")
      .eq("recording_id", raw.master_recording_id)
      .maybeSingle();
    segments = toSegments(check(transcript, "transcript")?.segments);
  }

  return { call, analysis, segments };
}

export async function getSettings(db: Db | null): Promise<SettingsData> {
  if (!db) return FIXTURE_SETTINGS;
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
