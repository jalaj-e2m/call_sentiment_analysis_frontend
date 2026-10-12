import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart } from "@/components/TrendChart";
import { SentimentBadge, StatusPill } from "@/components/sentiment";
import { Card, EmptyState, PageHeader, linkClass } from "@/components/ui";
import { getCallRows, getClient } from "@/lib/queries";
import { formatDate, negativeTopicCounts, rollingScore, trendSeries } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = await getDb();
  const [client, allCalls] = await Promise.all([getClient(db, id), getCallRows(db)]);
  if (!client) notFound();
  const calls = allCalls.filter((c) => c.clientId === id);
  const topics = negativeTopicCounts(calls).slice(0, 10);
  const rolling = rollingScore(calls);

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={`${calls.length} calls · rolling score ${rolling === null ? "–" : rolling.toFixed(1)}`}
      />
      {calls.length === 0 ? (
        <EmptyState title="No calls for this client yet." />
      ) : (
        <div className="space-y-6">
          <Card title="Score trend">
            <TrendChart data={trendSeries(calls)} series={[{ id: client.id, name: client.name }]} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Most frequent negative topics">
              {topics.length === 0 ? (
                <EmptyState title="No negative moments." />
              ) : (
                <ul className="space-y-1 text-sm">
                  {topics.map((t) => (
                    <li key={t.topic} className="flex justify-between gap-3">
                      <span className="capitalize">{t.topic}</span>
                      <span className="tabular-nums text-zinc-500">{t.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Timeline" className="lg:col-span-2">
              <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                {calls.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="w-28 whitespace-nowrap text-xs text-zinc-500">{formatDate(c.startedAt)}</span>
                    {c.analysis ? <SentimentBadge label={c.analysis.label} score={c.analysis.score} /> : <StatusPill status={c.status} />}
                    <Link href={`/calls/${c.id}`} className={linkClass}>
                      {c.title || "Untitled call"}
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
