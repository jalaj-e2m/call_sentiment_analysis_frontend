import type { AnalysisStatus, AppRole, Polarity, SentimentLabel } from "./database.types";

export type { AnalysisStatus, AppRole, Polarity, SentimentLabel };

export interface Profile {
  id: string;
  fullName: string | null;
  email: string;
  role: AppRole;
  active: boolean;
}

export interface MomentLite {
  polarity: Polarity;
  intensity: number;
  topic: string;
}

export interface AnalysisLite {
  id: string;
  score: number | null;
  label: SentimentLabel | null;
  triggerSource: "auto" | "manual";
  createdAt: string;
  moments: MomentLite[];
}

export interface CallRow {
  id: string;
  title: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  clientId: string | null;
  clientName: string;
  requiresManual: boolean;
  manualReason: string | null;
  status: AnalysisStatus;
  error: string | null;
  analysis: AnalysisLite | null;
}

export interface ClientRow {
  id: string;
  name: string;
  status: string;
}

export interface Moment {
  id: string;
  topic: string;
  emotion: string;
  polarity: Polarity;
  intensity: number;
  quote: string;
  speaker: string | null;
  timestampSeconds: number | null;
  quoteVerified: boolean;
  reasoning: string | null;
}

export interface DroppedCounts {
  non_client?: number;
  duplicate?: number;
  invalid_emotion?: number;
  too_short?: number;
}

export interface AnalysisStats {
  client_speech_share?: number;
  moments_proposed?: number;
  moments_kept?: number;
}

export interface AnalysisDetail {
  id: string;
  score: number | null;
  label: SentimentLabel | null;
  summary: string | null;
  scoreReasoning: string | null;
  triggerSource: "auto" | "manual";
  createdAt: string;
  dropped: DroppedCounts | null;
  stats: AnalysisStats | null;
  moments: Moment[];
}

export interface Segment {
  i: number;
  startSeconds: number | null;
  speakerName: string | null;
  text: string;
}

export interface CallDetail {
  call: CallRow;
  analysis: AnalysisDetail | null;
  segments: Segment[];
}

export interface SettingsData {
  settings: { key: string; value: unknown }[];
  prompt: { name: string; version: number; model: string; createdAt: string } | null;
}
