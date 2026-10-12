import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart } from "@/components/TrendChart";
import { SentimentBadge, StatusPill } from "@/components/sentiment";
import { Card, EmptyState, PageHeader } from "@/components/ui";
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
  const maxTopic = Math.max(1, ...topics.map((t) => t.count));
  const rolling = rollingScore(calls);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Clients
          </Link>
        }
        title={client.name}
        subtitle={`${calls.length} calls · rolling score ${rolling === null ? "–" : rolling.toFixed(1)}`}
      />
      {calls.length === 0 ? (
        <EmptyState title="No calls for this client yet." icon={Inbox} />
      ) : (
        <div className="space-y-6">
          <Card title="Score trend" description="Score per analysed call, out of 10">
            <TrendChart data={trendSeries(calls)} series={[{ id: client.id, name: client.name }]} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Most frequent negative topics">
              {topics.length === 0 ? (
                <EmptyState title="No negative moments." />
              ) : (
                <ul className="space-y-3 text-sm">
                  {topics.map((t) => (
                    <li key={t.topic}>
                      <div className="flex justify-between gap-3">
                        <span className="capitalize">{t.topic}</span>
                        <span className="tabular-nums text-zinc-500">{t.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-1.5 rounded-full bg-red-400/80" style={{ width: `${(t.count / maxTopic) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Timeline" className="lg:col-span-2" flush>
              <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {calls.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/calls/${c.id}`}
                      className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <span className="w-24 shrink-0 whitespace-nowrap text-xs text-zinc-500">{formatDate(c.startedAt)}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {c.title || "Untitled call"}
                      </span>
                      {c.analysis ? (
                        <SentimentBadge label={c.analysis.label} score={c.analysis.score} />
                      ) : (
                        <StatusPill status={c.status} />
                      )}
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
