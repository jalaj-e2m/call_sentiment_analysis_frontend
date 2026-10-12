/**
 * Hand-written subset of the backend schema (call_sentiment_analysis_backend/supabase/migrations),
 * covering only what the frontend reads. Replace with `supabase gen types typescript` output
 * when convenient; the shapes here match the migrations.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "specialist" | "associate" | "engineer";
export type SentimentLabel = "happy" | "neutral" | "unhappy";
export type AnalysisStatus = "not_started" | "queued" | "running" | "done" | "failed";
export type Polarity = "positive" | "negative" | "neutral";

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: Table<{ id: string; full_name: string | null; email: string; role: AppRole; active: boolean }>;
      clients: Table<{ id: string; name: string; status: string }>;
      calls: Table<{
        id: string;
        title: string | null;
        started_at: string | null;
        duration_seconds: number | null;
        client_id: string | null;
        call_type: "unclassified" | "client" | "internal" | "excluded";
        excluded: boolean;
        requires_manual_analysis: boolean;
        manual_reason: string | null;
        analysis_status: AnalysisStatus;
        analysis_error: string | null;
        master_recording_id: string | null;
        attendee_emails: string[];
        external_domains: string[];
        needs_review: boolean;
      }>;
      analyses: Table<{
        id: string;
        call_id: string;
        prompt_version_id: string | null;
        sentiment_score: number | null;
        overall_sentiment: SentimentLabel | null;
        summary: string | null;
        score_reasoning: string | null;
        trigger_source: "auto" | "manual";
        triggered_by: string | null;
        is_current: boolean;
        raw_output: Json | null;
        created_at: string;
      }>;
      sentiment_moments: Table<{
        id: string;
        analysis_id: string;
        call_id: string;
        client_id: string | null;
        topic: string;
        emotion: string;
        polarity: Polarity;
        intensity: number;
        quote: string;
        speaker: string | null;
        timestamp_seconds: number | null;
        quote_verified: boolean;
        reasoning: string | null;
        created_at: string;
      }>;
      recording_transcripts: Table<{ recording_id: string; segments: Json; full_text: string | null }>;
      recordings: Table<{
        id: string;
        call_id: string | null;
        invitees: Json;
        recorded_by_name: string | null;
        recorded_by_email: string | null;
      }>;
      app_settings: Table<{ key: string; value: Json }>;
      fathom_accounts: Table<{
        id: string;
        owner_id: string | null;
        label: string;
        active: boolean;
        vault_secret_id: string | null;
        key_last4: string | null;
        sync_status: "idle" | "running" | "failed";
        sync_started_at: string | null;
        last_sync_at: string | null;
        last_sync_error: string | null;
        last_sync_result: Json | null;
        synced_through: string | null;
      }>;
      prompt_versions: Table<{
        id: string;
        name: string;
        version: number;
        system_prompt: string;
        model: string;
        is_active: boolean;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
