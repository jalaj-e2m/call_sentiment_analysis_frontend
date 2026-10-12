import { Activity, CircleCheck, Gauge, Inbox, ListChecks, PieChart, TrendingDown } from "lucide-react";
import Link from "next/link";
import { ViewControls } from "@/components/controls";
import { ScoreTimeline } from "@/components/ScoreTimeline";
import { MomentDots, ScoreChip } from "@/components/sentiment";
import { Card, Delta, EmptyState, KpiCard, PageHeader } from "@/components/ui";
import { BarList, CoverageBar, EmotionMixBars, Heatmap, Sparkline } from "@/components/viz";
import {
  QUIET_DAYS,
  RANGE_LABELS,
  attentionCalls,
  awaitingManual,
  callsInPeriod,
  emotionMix,
  momentCounts,
  negativeTopics,
  parseRange,
  periodFor,
  periodKpis,
  periodPhrase,
  periodWeeks,
  portfolioHeatmap,
  rangeHref,
  scoreBand,
  scoreTimeline,
  stripClientName,
  watchlist,
  type Period,
} from "@/lib/analytics";
import { isAdmin, personName } from "@/lib/access";
import type { CallRow, ClientRow } from "@/lib/model";
import { formatDate } from "@/lib/sentiment";
import { loadScope, requireUnlocked } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function attentionReason(c: CallRow): string {
  if (c.analysis?.label === "unhappy") return "Unhappy call";
  const strong = c.analysis?.moments.find((m) => m.polarity === "negative" && m.intensity >= 3);
  return strong ? `Strong negative: ${strong.topic}` : "Negative moment";
}

function CallLine({ call, meta }: { call: CallRow; meta?: string }) {
  const counts = momentCounts(call.analysis?.moments ?? []);
  return (
    <li>
      <Link
        href={`/calls/${call.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] dark:hover:bg-zinc-800/40"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{call.clientName}</span>
          <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">
            {stripClientName(call.title, call.clientName)} · {formatDate(call.startedAt)}
            {meta ? <> · {meta}</> : null}
          </span>
        </span>
        <span className="hidden sm:block">
          <MomentDots {...counts} />
        </span>
        <ScoreChip score={call.analysis?.score} />
      </Link>
    </li>
  );
}

function Watchlist({ calls, clients, p, now }: { calls: CallRow[]; clients: ClientRow[]; p: Period; now: Date }) {
  const w = watchlist(calls, clients, p, now);
  const column = "min-w-0 border-zinc-100 dark:border-zinc-800";
  const heading = "px-4 pb-1 pt-3 text-xs font-medium text-zinc-600 dark:text-zinc-400";
  return (
    <Card title="Watchlist" description="Nothing urgent. Worth a look before it becomes a problem." flush>
      <div className="grid divide-y divide-zinc-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:divide-zinc-800">
        <section className={column} aria-label="Lowest scores">
          <h3 className={heading}>Lowest scores</h3>
          {w.lowest.length ? (
            <ul className="pb-2">
              {w.lowest.map((c) => (
                <CallLine key={c.id} call={c} />
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-3 text-sm text-zinc-600 dark:text-zinc-400">No scored calls.</p>
          )}
        </section>
        <section className={column} aria-label="Negative moments">
          <h3 className={heading}>Negative moments of intensity 2 or more</h3>
          {w.negative.length ? (
            <ul className="pb-2">
              {w.negative.map((c) => (
                <CallLine key={c.id} call={c} />
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-3 text-sm text-zinc-600 dark:text-zinc-400">None.</p>
          )}
        </section>
        <section className={column} aria-label="Quiet clients">
          <h3 className={heading}>No analysed call in {QUIET_DAYS} days</h3>
          {w.quietClients.length ? (
            <ul className="pb-2">
              {w.quietClients.map(({ client, daysSince }) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{client.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                      {daysSince === null ? "never analysed" : `${daysSince} days`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-3 text-sm text-zinc-600 dark:text-zinc-400">Every client had an analysed call recently.</p>
          )}
        </section>
      </div>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireUnlocked();
  if (!member) return null;
  const params = await searchParams;
  const range = parseRange(params.range);
  const { calls, clients, members, person } = await loadScope(member.db, member.profile, params.person);
  const clientHref = (id: string) => rangeHref(`/clients/${id}`, range, person?.id);
  const now = new Date();
  const p = periodFor(range, now);
  const weeks = periodWeeks(p, calls);
  const current = callsInPeriod(calls, p);
  const kpis = periodKpis(calls, p, weeks);
  const manual = awaitingManual(calls);
  const attention = attentionCalls(calls, p);
  const phrase = periodPhrase(range);
  const timeline = scoreTimeline(calls, p);
  const domainStart = p.start ?? Math.min(...timeline.flatMap((s) => s.points.map((pt) => pt.t)), p.end - 7 * 86_400_000);
  const topics = negativeTopics(current);
  const mix = emotionMix(clients, current);
  const avgBand = kpis.averageScore === null ? null : scoreBand(kpis.averageScore);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`How clients felt on ${person ? `${personName(person)}'s calls` : isAdmin(member.profile) ? "calls" : "your calls"} in ${phrase}`}
        actions={<ViewControls range={range} path="/" members={members} person={person} />}
      />
      {calls.length === 0 ? (
        <EmptyState title={person ? `No client calls for ${personName(person)}.` : "No client calls yet."} icon={Inbox}>
          {person ? "They have not synced or been invited to a client call yet." : "Connect Fathom and click Sync now in the sidebar to import your calls."}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Calls analysed" value={kpis.analysed} icon={Activity}>
              {kpis.delta === null ? "All time" : <Delta value={kpis.delta} suffix={`vs previous ${RANGE_LABELS[range]}`} />}
            </KpiCard>
            <KpiCard
              label="Average score"
              value={
                kpis.averageScore === null ? (
                  "–"
                ) : (
                  <>
                    {kpis.averageScore.toFixed(1)}
                    <span className="ml-1.5 align-middle text-xs font-medium capitalize text-zinc-600 dark:text-zinc-400">{avgBand}</span>
                  </>
                )
              }
              icon={Gauge}
              tone={avgBand === "unhappy" ? "alert" : avgBand === "neutral" ? "warning" : "default"}
            >
              <Sparkline cells={kpis.weekly} width={120} />
            </KpiCard>
            <KpiCard label="Unhappy calls" value={kpis.unhappy} icon={TrendingDown} tone={kpis.unhappy > 0 ? "alert" : "default"}>
              {kpis.unhappy > 0 ? `${Math.round((kpis.unhappy / Math.max(1, kpis.analysed)) * 100)}% of analysed calls` : "None in this period"}
            </KpiCard>
            <KpiCard
              label="Coverage"
              value={kpis.coverage.ratio === null ? "–" : `${Math.round(kpis.coverage.ratio * 100)}%`}
              icon={PieChart}
              tone={kpis.coverage.ratio !== null && kpis.coverage.ratio < 0.5 ? "warning" : "default"}
            >
              <CoverageBar coverage={kpis.coverage} />
              <span className="sr-only"> calls analysed</span>
            </KpiCard>
            <KpiCard label="Awaiting manual analysis" value={manual.count} icon={ListChecks} tone={manual.count > 0 ? "warning" : "default"}>
              {manual.count === 0 ? (
                "Nothing waiting"
              ) : (
                <Link href="/calls?manual=1" className="line-clamp-2 hover:underline" title={manual.reasons.map((r) => `${r.label} (${r.count})`).join(", ")}>
                  {manual.reasons.map((r) => `${r.label} (${r.count})`).join(" · ")}
                </Link>
              )}
            </KpiCard>
          </div>

          {attention.length > 0 ? (
            <Card
              title={
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sent-unhappy" aria-hidden />
                  Needs attention
                  <span className="rounded-full bg-sent-unhappy-soft px-1.5 text-xs font-medium tabular-nums text-sent-unhappy-fg">{attention.length}</span>
                </span>
              }
              description={`Unhappy calls and strong negative moments in ${phrase}`}
              flush
              className="border-sent-unhappy-line"
            >
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {attention.slice(0, 8).map((c) => (
                  <CallLine key={c.id} call={c} meta={attentionReason(c)} />
                ))}
              </ul>
              {attention.length > 8 ? (
                <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  {attention.length - 8} more. <Link href="/calls?label=unhappy" className="underline">See unhappy calls</Link>
                </p>
              ) : null}
            </Card>
          ) : (
            <>
              <p className="flex items-center gap-2 rounded-lg border border-sent-happy-line bg-sent-happy-soft px-4 py-2 text-sm text-sent-happy-fg" role="status">
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">All clear.</span> No unhappy calls or strong negative moments in {phrase}.
                </span>
              </p>
              <Watchlist calls={calls} clients={clients} p={p} now={now} />
            </>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Portfolio" description="Average score per client per week. Click a row or cell to open the client.">
              {weeks.length && current.some((c) => c.analysis) ? (
                <Heatmap rows={portfolioHeatmap(clients, calls, weeks)} weeks={weeks} hrefFor={clientHref} />
              ) : (
                <EmptyState title="No analysed calls in this period." />
              )}
            </Card>
            <Card title="Score timeline" description="Each dot is an analysed call. Shaded bands: 1-4 unhappy, 5-6 neutral, 7-10 happy.">
              <ScoreTimeline series={timeline} domain={[domainStart, p.end]} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Top topics behind negative moments" description={`Negative moments in ${phrase}, by topic`}>
              {topics.length ? (
                <BarList items={topics.map((t) => ({ label: t.topic, value: t.count }))} label="Negative moments by topic" />
              ) : (
                <EmptyState title="No negative moments in this period." />
              )}
            </Card>
            <Card title="Emotion mix by client" description={`Negative vs positive moments in ${phrase}, most negative first`}>
              {mix.length ? (
                <EmotionMixBars
                  label="Negative and positive moments per client"
                  rows={mix.map((r) => ({
                    key: r.client.id,
                    label: (
                      <Link href={clientHref(r.client.id)} className="hover:underline">
                        {r.client.name}
                      </Link>
                    ),
                    negative: r.negative,
                    positive: r.positive,
                  }))}
                />
              ) : (
                <EmptyState title="No moments in this period." />
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
