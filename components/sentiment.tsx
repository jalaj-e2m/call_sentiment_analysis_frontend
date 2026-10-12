import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react";
import { scoreBand } from "@/lib/analytics";
import type { AnalysisDetail, AnalysisStatus, Polarity, SentimentLabel } from "@/lib/model";
import { LOW_EVIDENCE_MESSAGE, NO_EVIDENCE_SCORE_MESSAGE, isLowEvidence, labelStyle, polarityClass } from "@/lib/sentiment";

const LABEL_ICON = { happy: Check, neutral: Minus, unhappy: ArrowDown } as const;

export function SentimentBadge({ label, score }: { label: SentimentLabel | null | undefined; score?: number | null }) {
  const style = labelStyle(label);
  const Icon = label ? LABEL_ICON[label] : null;
  return (
    <span
      data-label={label ?? "none"}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {style.text}
      {score !== undefined && score !== null ? <span className="tabular-nums opacity-80">{score}/10</span> : null}
    </span>
  );
}

const SCORE_TEXT = {
  unhappy: "text-sent-unhappy-fg font-semibold",
  neutral: "text-sent-neutral-fg font-semibold",
  happy: "text-zinc-700 dark:text-zinc-300",
} as const;
const SCORE_BAR = { unhappy: "bg-sent-unhappy", neutral: "bg-sent-neutral", happy: "bg-sent-happy" } as const;

/** Score as a number with a small 0-10 bar. Provisional = fewer than 3 analysed calls behind it. */
export function ScoreChip({
  score,
  decimals = 0,
  provisional = false,
  lowEvidence = false,
}: {
  score: number | null | undefined;
  decimals?: number;
  provisional?: boolean;
  lowEvidence?: boolean;
}) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        <span aria-hidden>–</span>
        <span className="sr-only">No score</span>
      </span>
    );
  }
  const band = scoreBand(score);
  const text = score.toFixed(decimals);
  const notes = [provisional ? "provisional, fewer than 3 analysed calls" : null, lowEvidence ? "low evidence" : null].filter(Boolean);
  return (
    <span
      className="inline-flex items-center gap-2"
      data-band={band}
      aria-label={`Score ${text} of 10${notes.length ? `, ${notes.join(", ")}` : ""}`}
    >
      <span className={`w-7 text-right text-sm tabular-nums ${lowEvidence ? "text-zinc-500 dark:text-zinc-400" : SCORE_TEXT[band]}`} aria-hidden>
        {text}
      </span>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden>
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${lowEvidence ? "bg-zinc-400" : SCORE_BAR[band]}`}
          style={{ width: `${Math.max(0, Math.min(10, score)) * 10}%` }}
        />
      </span>
      {provisional ? (
        <span
          className="rounded border border-dashed border-zinc-400 px-1 text-[10px] font-medium uppercase leading-4 tracking-wide text-zinc-600 dark:border-zinc-500 dark:text-zinc-400"
          title="Provisional: fewer than 3 analysed calls"
          aria-hidden
        >
          prov
        </span>
      ) : null}
    </span>
  );
}

/** Large score; greyed out when the evidence is weak. */
export function ScoreValue({ score, lowEvidence }: { score: number | null; lowEvidence: boolean }) {
  if (score === null) {
    return <span className="text-sm text-zinc-600 dark:text-zinc-400">{NO_EVIDENCE_SCORE_MESSAGE}</span>;
  }
  const band = scoreBand(score);
  return (
    <span
      title={lowEvidence ? "Low-confidence score" : undefined}
      className={`text-3xl font-semibold tabular-nums ${lowEvidence ? "text-zinc-500 dark:text-zinc-500" : band === "happy" ? "" : SCORE_TEXT[band]}`}
    >
      {score}
      <span className="text-base font-normal text-zinc-500">/10</span>
    </span>
  );
}

const POLARITY_ICON = { negative: ArrowDown, positive: ArrowUp, neutral: Minus } as const;

export function EmotionChip({ emotion, polarity }: { emotion: string; polarity: Polarity }) {
  const Icon = POLARITY_ICON[polarity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${polarityClass(polarity)}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="sr-only">{polarity} </span>
      {emotion}
    </span>
  );
}

export function IntensityDots({ intensity, polarity }: { intensity: number; polarity?: Polarity }) {
  const on =
    polarity === "negative"
      ? "bg-sent-unhappy"
      : polarity === "positive"
        ? "bg-sent-happy"
        : "bg-zinc-700 dark:bg-zinc-200";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Intensity ${intensity} of 3`} title={`Intensity ${intensity}/3`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= intensity ? on : "bg-zinc-200 dark:bg-zinc-700"}`} />
      ))}
    </span>
  );
}

/** Negative / positive moment counts as small coloured dots with numbers. */
export function MomentDots({ negative, positive }: { negative: number; positive: number }) {
  if (negative + positive === 0) {
    return <span className="text-xs text-zinc-500 dark:text-zinc-400">–</span>;
  }
  return (
    <span className="inline-flex items-center gap-2.5 text-xs tabular-nums" aria-label={`${negative} negative, ${positive} positive moments`}>
      <span className={`inline-flex items-center gap-1 ${negative ? "font-medium text-sent-unhappy-fg" : "text-zinc-400 dark:text-zinc-500"}`} aria-hidden>
        <span className={`h-2 w-2 rounded-full ${negative ? "bg-sent-unhappy" : "bg-zinc-300 dark:bg-zinc-600"}`} />
        {negative}
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400" aria-hidden>
        <span className={`h-2 w-2 rounded-full ${positive ? "bg-sent-happy" : "bg-zinc-300 dark:bg-zinc-600"}`} />
        {positive}
      </span>
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

export function Spinner({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 motion-reduce:animate-none dark:border-zinc-600 dark:border-t-zinc-200 ${className}`}
    />
  );
}

export function StatusPill({ status }: { status: AnalysisStatus }) {
  const busy = status === "running" || status === "queued";
  const tone =
    status === "failed"
      ? "text-sent-unhappy-fg"
      : status === "done"
        ? "text-zinc-600 dark:text-zinc-400"
        : "text-zinc-700 dark:text-zinc-300";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${tone}`}>
      {busy ? <Spinner /> : null}
      {STATUS_TEXT[status]}
    </span>
  );
}
