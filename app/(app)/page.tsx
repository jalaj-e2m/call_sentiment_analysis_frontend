import Link from "next/link";
import { TrendChart } from "@/components/TrendChart";
import { SentimentBadge } from "@/components/sentiment";
import { Card, EmptyState, PageHeader, linkClass } from "@/components/ui";
import type { CallRow } from "@/lib/model";
import { getCallRows } from "@/lib/queries";
import {
  RECENT_DAYS,
  dashboardKpis,
  formatDate,
  hasStrongNegative,
  needsAttention,
  recentAnalysed,
  trendSeries,
} from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}

function CallList({ calls, reason }: { calls: CallRow[]; reason?: boolean }) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {calls.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
          <SentimentBadge label={c.analysis?.label} score={c.analysis?.score} />
          <Link href={`/calls/${c.id}`} className={linkClass}>
            {c.clientName}
          </Link>
          <span className="truncate text-zinc-500">{c.title || "Untitled call"}</span>
          {reason && hasStrongNegative(c) ? (
            <span className="text-xs text-red-700 dark:text-red-300">strong negative moment</span>
          ) : null}
          <span className="ml-auto whitespace-nowrap text-xs text-zinc-500">{formatDate(c.startedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const calls = await getCallRows(await getDb());
  const kpis = dashboardKpis(calls, new Date());
  const attention = needsAttention(calls).slice(0, 10);
  const recent = recentAnalysed(calls, 10);
  const series = [...new Map(calls.filter((c) => c.analysis && c.clientId).map((c) => [c.clientId!, c.clientName]))].map(
    ([id, name]) => ({ id, name }),
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="How clients felt on recent calls" />
      {calls.length === 0 ? (
        <EmptyState title="No client calls yet.">Calls appear here after the backfill and analysis scripts run.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Calls analysed" value={kpis.analysedRecent} hint={`Last ${RECENT_DAYS} days`} />
            <Kpi label="Unhappy calls" value={kpis.unhappyRecent} hint={`Last ${RECENT_DAYS} days`} />
            <Kpi
              label="Average score"
              value={kpis.averageScoreRecent === null ? "–" : kpis.averageScoreRecent.toFixed(1)}
              hint={`Last ${RECENT_DAYS} days, out of 10`}
            />
            <Kpi label="Awaiting manual analysis" value={kpis.awaitingManual} hint="Manual-only calls" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Needs attention">
              {attention.length === 0 ? (
                <EmptyState title="Nothing needs attention." />
              ) : (
                <CallList calls={attention} reason />
              )}
            </Card>
            <Card title="Recent analysed calls">
              {recent.length === 0 ? <EmptyState title="No analysed calls yet." /> : <CallList calls={recent} />}
            </Card>
          </div>

          <Card title="Sentiment trend by client">
            <TrendChart data={trendSeries(calls)} series={series} />
          </Card>
        </div>
      )}
    </>
  );
}
