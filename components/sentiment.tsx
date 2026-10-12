import type { AnalysisDetail, AnalysisStatus, Polarity, SentimentLabel } from "@/lib/model";
import { LOW_EVIDENCE_MESSAGE, NO_EVIDENCE_SCORE_MESSAGE, isLowEvidence, labelStyle, polarityClass } from "@/lib/sentiment";

export function SentimentBadge({ label, score }: { label: SentimentLabel | null | undefined; score?: number | null }) {
  const style = labelStyle(label);
  return (
    <span
      data-label={label ?? "none"}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {style.text}
      {score !== undefined && score !== null ? <span className="tabular-nums opacity-80">{score}/10</span> : null}
    </span>
  );
}

/** Large score; greyed out when the evidence is weak. */
export function ScoreValue({ score, lowEvidence }: { score: number | null; lowEvidence: boolean }) {
  if (score === null) {
    return <span className="text-sm text-zinc-500 dark:text-zinc-400">{NO_EVIDENCE_SCORE_MESSAGE}</span>;
  }
  return (
    <span
      title={lowEvidence ? "Low-confidence score" : undefined}
      className={`text-3xl font-semibold tabular-nums ${lowEvidence ? "text-zinc-400 dark:text-zinc-600" : ""}`}
    >
      {score}
      <span className="text-base font-normal text-zinc-400">/10</span>
    </span>
  );
}

export function EmotionChip({ emotion, polarity }: { emotion: string; polarity: Polarity }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${polarityClass(polarity)}`}>
      {emotion}
    </span>
  );
}

export function IntensityDots({ intensity }: { intensity: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Intensity ${intensity} of 3`} title={`Intensity ${intensity}/3`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 w-2 rounded-full ${n <= intensity ? "bg-zinc-700 dark:bg-zinc-200" : "bg-zinc-200 dark:bg-zinc-700"}`}
        />
      ))}
    </span>
  );
}

export function LowEvidenceNotice({ analysis }: { analysis: Pick<AnalysisDetail, "score" | "moments" | "dropped"> }) {
  if (!isLowEvidence(analysis)) return null;
  return (
    <div
      role="note"
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
    >
      {analysis.score === null ? `${NO_EVIDENCE_SCORE_MESSAGE} ` : ""}
      {LOW_EVIDENCE_MESSAGE}
    </div>
  );
}

const STATUS_TEXT: Record<AnalysisStatus, string> = {
  not_started: "Not started",
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

export function StatusPill({ status }: { status: AnalysisStatus }) {
  const busy = status === "running" || status === "queued";
  const tone =
    status === "failed"
      ? "text-red-700 dark:text-red-300"
      : status === "done"
        ? "text-zinc-600 dark:text-zinc-400"
        : "text-zinc-700 dark:text-zinc-300";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${tone}`}>
      {busy ? (
        <span
          aria-hidden
          className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200"
        />
      ) : null}
      {STATUS_TEXT[status]}
    </span>
  );
}
