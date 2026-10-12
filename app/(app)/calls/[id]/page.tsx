import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MomentsAndTranscript } from "@/components/MomentsAndTranscript";
import { LowEvidenceNotice, ScoreValue, SentimentBadge, StatusPill } from "@/components/sentiment";
import { Card, Notice, PageHeader, linkClass } from "@/components/ui";
import { getCallDetail } from "@/lib/queries";
import { canAnalyze, canRetry, formatDate, formatDuration, isInProgress, isLowEvidence } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const detail = await getCallDetail(await getDb(), id);
  if (!detail) notFound();
  const { call, analysis, segments } = detail;

  return (
    <>
      <AutoRefresh active={isInProgress(call.status)} />
      <PageHeader
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
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={call.status} />
            {canAnalyze(call) || canRetry(call) ? <AnalyzeButton callId={call.id} retry={canRetry(call)} /> : null}
          </div>
        }
      />

      {call.status === "failed" && call.error ? (
        <div className="mb-4">
          <Notice tone="error">Last analysis failed: {call.error}</Notice>
        </div>
      ) : null}

      {!analysis ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isInProgress(call.status)
              ? "Analysis is running. This page refreshes automatically."
              : call.requiresManual
                ? `This call needs manual analysis${call.manualReason ? ` (${call.manualReason})` : ""}. Use Analyze to run it.`
                : "This call has not been analysed yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Overall">
              <div className="flex items-center gap-3">
                <ScoreValue score={analysis.score} lowEvidence={isLowEvidence(analysis)} />
                <SentimentBadge label={analysis.label} />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {analysis.triggerSource === "manual" ? "Manual analysis" : "Automatic analysis"} · {formatDate(analysis.createdAt)}
              </p>
              <div className="mt-3">
                <LowEvidenceNotice analysis={analysis} />
              </div>
            </Card>
            <Card title="Summary" className="lg:col-span-2">
              <p className="text-sm leading-relaxed">{analysis.summary || "No summary."}</p>
              {analysis.scoreReasoning ? (
                <>
                  <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Why this score</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{analysis.scoreReasoning}</p>
                </>
              ) : null}
            </Card>
          </div>
          <MomentsAndTranscript moments={analysis.moments} segments={segments} />
        </div>
      )}
    </>
  );
}
