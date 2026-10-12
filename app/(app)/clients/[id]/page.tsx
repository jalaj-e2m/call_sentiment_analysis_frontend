import { Activity, Clock, Gauge, Inbox, TrendingDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewControls } from "@/components/controls";
import { ScoreTimeline } from "@/components/ScoreTimeline";
import { EmotionChip, MomentDots, ScoreChip, SentimentBadge, StatusPill } from "@/components/sentiment";
import { Card, EmptyState, KpiCard, PageHeader } from "@/components/ui";
import { BarList, CoverageBar, EmotionMixBars } from "@/components/viz";
import {
  PROVISIONAL_BELOW,
  callsInPeriod,
  clientOverview,
  emotionCounts,
  momentCounts,
  negativeTopics,
  parseRange,
  periodFor,
  periodPhrase,
  periodWeeks,
  rangeHref,
  scoreTimeline,
  stripClientName,
} from "@/lib/analytics";
import { personName } from "@/lib/access";
import { getClient } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/sentiment";
import { loadScope, requireUnlocked } from "@/lib/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const range = parseRange(query.range);
  const member = await requireUnlocked();
  if (!member) return null;
  const [client, scope] = await Promise.all([getClient(member.db, id), loadScope(member.db, member.profile, query.person)]);
  if (!client) notFound();
  const { members, person } = scope;
  const allCalls = scope.calls;

  const now = new Date();
  const p = periodFor(range, now);
  const calls = allCalls.filter((c) => c.clientId === id);
  const current = callsInPeriod(calls, p);
  const overview = clientOverview([client], calls, p, periodWeeks(p, calls), now)[0]!;
  const timeline = scoreTimeline(calls, p);
  const domainStart = p.start ?? Math.min(...timeline.flatMap((s) => s.points.map((pt) => pt.t)), p.end - 7 * 86_400_000);
  const topics = negativeTopics(current, 10);
  const emotions = emotionCounts(current);
  const counts = momentCounts(current.flatMap((c) => c.analysis?.moments ?? []));
  const phrase = periodPhrase(range);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: rangeHref("/clients", range, person?.id) }, { label: client.name }]}
        title={client.name}
        subtitle={`${person ? `${personName(person)}'s calls · ` : ""}${calls.length} calls in total · ${current.length} in ${phrase}`}
        actions={<ViewControls range={range} path={`/clients/${id}`} members={members} person={person} />}
      />
      {calls.length === 0 ? (
        <EmptyState title="No calls for this client yet." icon={Inbox} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Score (last 3 scored calls)"
              value={overview.rollingScore === null ? "–" : overview.rollingScore.toFixed(1)}
              icon={Gauge}
              tone={overview.rollingScore === null ? "default" : overview.rollingScore <= 4 ? "alert" : overview.rollingScore <= 6 ? "warning" : "default"}
            >
              {overview.rollingScore !== null && overview.provisional
                ? `Provisional: fewer than ${PROVISIONAL_BELOW} analysed calls`
                : `${overview.scoredCount} scored calls in total`}
            </KpiCard>
            <KpiCard label="Coverage" value={`${overview.coverage.analysed}/${overview.coverage.total}`} icon={Activity}>
              <CoverageBar coverage={overview.coverage} />
            </KpiCard>
            <KpiCard
              label="Negative moments"
              value={overview.negativeMoments}
              icon={TrendingDown}
              tone={overview.negativeMoments > 0 && overview.latestLabel === "unhappy" ? "alert" : "default"}
            >
              {counts.positive} positive in {phrase}
            </KpiCard>
            <KpiCard
              label="Last call"
              value={overview.daysSinceLastCall === null ? "–" : overview.daysSinceLastCall === 0 ? "Today" : `${overview.daysSinceLastCall} d`}
              icon={Clock}
              tone={overview.daysSinceLastCall !== null && overview.daysSinceLastCall > 21 ? "warning" : "default"}
            >
              {overview.latestLabel ? <SentimentBadge label={overview.latestLabel} /> : "Not analysed yet"}
            </KpiCard>
          </div>

          <Card title="Score timeline" description="Each dot is an analysed call. Shaded bands: 1-4 unhappy, 5-6 neutral, 7-10 happy.">
            <ScoreTimeline series={timeline} domain={[domainStart, p.end]} height={220} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Emotion mix" description={`Client moments in ${phrase}`}>
              {emotions.length === 0 ? (
                <EmptyState title="No moments in this period." />
              ) : (
                <div className="space-y-4">
                  <EmotionMixBars label="Negative and positive moments" rows={[{ key: "all", label: "All moments", ...counts }]} />
                  <ul className="flex flex-wrap gap-2" aria-label="Moments by emotion">
                    {emotions.map((e) => (
                      <li key={e.emotion} className="inline-flex items-center gap-1">
                        <EmotionChip emotion={e.emotion} polarity={e.polarity} />
                        <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">×{e.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            <Card title="Top negative topics" description={`Negative moments in ${phrase}, by topic`}>
              {topics.length === 0 ? (
                <EmptyState title="No negative moments in this period." />
              ) : (
                <BarList items={topics.map((t) => ({ label: t.topic, value: t.count }))} label="Negative moments by topic" />
              )}
            </Card>
          </div>

          <Card title="Call timeline" description={`Calls in ${phrase}, newest first`} flush>
            {current.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No calls in this period." />
              </div>
            ) : (
              <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {current.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/calls/${c.id}`}
                      className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 sm:grid-cols-[6rem_minmax(0,1fr)_4rem_6rem_auto] dark:hover:bg-zinc-800/40"
                    >
                      <span className="whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{formatDate(c.startedAt)}</span>
                      <span className="min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-100">{stripClientName(c.title, client.name)}</span>
                      <span className="hidden text-xs tabular-nums text-zinc-600 sm:block dark:text-zinc-400">{formatDuration(c.durationSeconds)}</span>
                      <span className="hidden sm:block">{c.analysis ? <MomentDots {...momentCounts(c.analysis.moments)} /> : null}</span>
                      <span className="flex items-center justify-end gap-2">
                        {c.analysis ? (
                          <>
                            <ScoreChip score={c.analysis.score} lowEvidence={c.analysis.moments.length === 0} />
                            <SentimentBadge label={c.analysis.label} />
                          </>
                        ) : (
                          <StatusPill status={c.status} />
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
