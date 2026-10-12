import { Activity, Gauge, Inbox, ListChecks, TrendingDown } from "lucide-react";
import Link from "next/link";
import { TrendChart } from "@/components/TrendChart";
import { SentimentBadge } from "@/components/sentiment";
import { Card, EmptyState, PageHeader, StatCard, buttonClass } from "@/components/ui";
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

function CallList({ calls, reason }: { calls: CallRow[]; reason?: boolean }) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {calls.map((c) => (
        <li key={c.id}>
          <Link
            href={`/calls/${c.id}`}
            className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{c.clientName}</p>
              <p className="truncate text-xs text-zinc-500">
                {c.title || "Untitled call"} · {formatDate(c.startedAt)}
                {reason && hasStrongNegative(c) ? (
                  <span className="text-red-700 dark:text-red-300"> · strong negative moment</span>
                ) : null}
              </p>
            </div>
            <SentimentBadge label={c.analysis?.label} score={c.analysis?.score} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const calls = await getCallRows(await getDb());
  const kpis = dashboardKpis(calls, new Date());
  const attention = needsAttention(calls).slice(0, 8);
  const recent = recentAnalysed(calls, 8);
  const series = [...new Map(calls.filter((c) => c.analysis && c.clientId).map((c) => [c.clientId!, c.clientName]))].map(
    ([id, name]) => ({ id, name }),
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`How clients felt on calls in the last ${RECENT_DAYS} days`}
        actions={
          <Link href="/calls" className={buttonClass}>
            View all calls
          </Link>
        }
      />
      {calls.length === 0 ? (
        <EmptyState title="No client calls yet." icon={Inbox}>
          Connect Fathom and click Sync now in the sidebar to import your calls.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Calls analysed" value={kpis.analysedRecent} hint={`Last ${RECENT_DAYS} days`} icon={Activity} />
            <StatCard
              label="Unhappy calls"
              value={kpis.unhappyRecent}
              hint={`Last ${RECENT_DAYS} days`}
              icon={TrendingDown}
              tone={kpis.unhappyRecent > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Average score"
              value={kpis.averageScoreRecent === null ? "–" : kpis.averageScoreRecent.toFixed(1)}
              hint="Out of 10"
              icon={Gauge}
            />
            <StatCard
              label="Awaiting manual analysis"
              value={kpis.awaitingManual}
              hint="Long or multi-recording calls"
              icon={ListChecks}
              tone={kpis.awaitingManual > 0 ? "warning" : "default"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Needs attention" description="Unhappy calls and strong negative moments" flush>
              {attention.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Nothing needs attention." />
                </div>
              ) : (
                <CallList calls={attention} reason />
              )}
            </Card>
            <Card title="Recently analysed" flush>
              {recent.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No analysed calls yet." />
                </div>
              ) : (
                <CallList calls={recent} />
              )}
            </Card>
          </div>

          <Card title="Sentiment trend by client" description="Score per analysed call, out of 10">
            <TrendChart data={trendSeries(calls)} series={series} />
          </Card>
        </div>
      )}
    </>
  );
}
