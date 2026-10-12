import { Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MeetingPeople } from "@/components/MeetingPeople";
import { MomentsAndTranscript } from "@/components/MomentsAndTranscript";
import { LowEvidenceNotice, ScoreValue, SentimentBadge, StatusPill } from "@/components/sentiment";
import { Card, EmptyState, Notice, PageHeader, linkClass } from "@/components/ui";
import { stripClientName } from "@/lib/analytics";
import { getCallDetail } from "@/lib/queries";
import { canAnalyze, canRetry, formatDate, formatDuration, isInProgress, isLowEvidence } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const detail = await getCallDetail(await getDb(), id);
  if (!detail) notFound();
  const { call, analysis, segments, people } = detail;
  const title = stripClientName(call.title, call.clientName);

  return (
    <>
      <AutoRefresh active={isInProgress(call.status)} />
      <PageHeader
        breadcrumbs={[
          { label: "Calls", href: "/calls" },
          call.clientId ? { label: call.clientName, href: `/clients/${call.clientId}` } : { label: call.clientName },
          { label: title },
        ]}
        title={call.title || "Untitled call"}
        subtitle={
          <>
            {call.clientId ? (
              <Link href={`/clients/${call.clientId}`} className={linkClass}>
                {call.clientName}
              </Link>
            ) : (
              call.clientName
            )}{" "}
            · {formatDate(call.startedAt)} · {formatDuration(call.durationSeconds)}
            {call.requiresManual ? <> · Manual-only ({call.manualLabel ?? "marked for manual analysis"})</> : null}
          </>
        }
        actions={
          <>
            <StatusPill status={call.status} />
            {canAnalyze(call) || canRetry(call) ? <AnalyzeButton callId={call.id} retry={canRetry(call)} /> : null}
          </>
        }
      />

      {call.status === "failed" && call.error ? (
        <div className="mb-4">
          <Notice tone="error">Last analysis failed: {call.error}</Notice>
        </div>
      ) : null}

      {!analysis ? (
        <div className="space-y-6">
          <EmptyState title={isInProgress(call.status) ? "Analysis is running" : "Not analysed yet"} icon={Sparkles}>
            {isInProgress(call.status)
              ? "This page refreshes automatically."
              : call.requiresManual
                ? `This call needs manual analysis (${call.manualLabel ?? "marked for manual analysis"}). Use Analyze to run it.`
                : "Use Analyze to run it."}
          </EmptyState>
          <MeetingPeople people={people} />
        </div>
      ) : (
        <MomentsAndTranscript
          moments={analysis.moments}
          segments={segments}
          durationSeconds={call.durationSeconds}
          summary={
            <>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <ScoreValue score={analysis.score} lowEvidence={isLowEvidence(analysis)} />
                  <SentimentBadge label={analysis.label} />
                  <span className="ml-auto text-xs text-zinc-600 dark:text-zinc-400">
                    {analysis.triggerSource === "manual" ? "Manual analysis" : "Automatic analysis"} · {formatDate(analysis.createdAt)}
                  </span>
                </div>
                {typeof analysis.stats?.client_speech_share === "number" ? (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    Client speech {Math.round(analysis.stats.client_speech_share * 100)}% of the transcript
                    {typeof analysis.stats.moments_proposed === "number"
                      ? ` · ${analysis.stats.moments_kept ?? 0} of ${analysis.stats.moments_proposed} proposed moments kept`
                      : ""}
                  </p>
                ) : null}
                <div className="mt-3 empty:hidden">
                  <LowEvidenceNotice analysis={analysis} />
                </div>
                <h2 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Summary</h2>
                <p className="mt-1 text-sm leading-relaxed">{analysis.summary || "No summary."}</p>
                {analysis.scoreReasoning ? (
                  <>
                    <h2 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Why this score</h2>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{analysis.scoreReasoning}</p>
                  </>
                ) : null}
              </Card>
              <MeetingPeople people={people} />
            </>
          }
        />
      )}
    </>
  );
}
