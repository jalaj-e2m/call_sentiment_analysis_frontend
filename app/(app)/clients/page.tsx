import { Building, Clock, TrendingDown, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewControls } from "@/components/controls";
import { RowLink } from "@/components/RowLink";
import { ScoreChip } from "@/components/sentiment";
import { Card, EmptyState, PageHeader, TableWrap, rowClass, td, th } from "@/components/ui";
import { CoverageBar, Sparkline } from "@/components/viz";
import {
  PROVISIONAL_BELOW,
  QUIET_DAYS,
  ROLLING_WINDOW,
  clientOverview,
  parseRange,
  periodFor,
  periodPhrase,
  periodWeeks,
  rangeHref,
  type ClientOverview,
} from "@/lib/analytics";
import { personName } from "@/lib/access";
import { loadScope, requireUnlocked } from "@/lib/session";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Why a client is near the top, in words (never colour alone). */
function attentionNotes(r: ClientOverview): { text: string; tone: "alert" | "warning"; icon: typeof TriangleAlert }[] {
  const notes: { text: string; tone: "alert" | "warning"; icon: typeof TriangleAlert }[] = [];
  if (r.latestLabel === "unhappy") notes.push({ text: "Latest call unhappy", tone: "alert", icon: TriangleAlert });
  else if (r.rollingScore !== null && r.rollingScore <= 4) notes.push({ text: "Low score", tone: "alert", icon: TrendingDown });
  if (r.daysSinceLastCall === null || r.daysSinceLastCall > QUIET_DAYS) notes.push({ text: "Quiet", tone: "warning", icon: Clock });
  return notes;
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireUnlocked();
  if (!member) return null;
  const params = await searchParams;
  const range = parseRange(params.range);
  const { calls, clients, members, person } = await loadScope(member.db, member.profile, params.person);
  const now = new Date();
  const p = periodFor(range, now);
  const rows = clientOverview(clients, calls, p, periodWeeks(p, calls), now);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${person ? `Clients on ${personName(person)}'s calls. ` : ""}Most attention needed first. Score = average of the last ${ROLLING_WINDOW} scored calls; coverage, trend and moments cover ${periodPhrase(range)}.`}
        actions={<ViewControls range={range} path="/clients" members={members} person={person} />}
      />
      {rows.length === 0 ? (
        <EmptyState title={person ? `No clients on ${personName(person)}'s calls yet.` : "No clients yet."} icon={Building} />
      ) : (
        <Card flush>
          <TableWrap minWidth={820}>
            <thead>
              <tr>
                <th className={th} scope="col">
                  Client
                </th>
                <th className={th} scope="col">
                  Score
                </th>
                <th className={th} scope="col">
                  Coverage
                </th>
                <th className={th} scope="col">
                  Weekly trend
                </th>
                <th className={`${th} text-right`} scope="col">
                  Last call
                </th>
                <th className={`${th} text-right`} scope="col">
                  Negative moments
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const notes = attentionNotes(r);
                const href = rangeHref(`/clients/${r.client.id}`, range, person?.id);
                return (
                  <RowLink key={r.client.id} href={href} className={rowClass}>
                    <td className={td}>
                      <Link href={href} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                        {r.client.name}
                      </Link>
                      {notes.length ? (
                        <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                          {notes.map(({ text, tone, icon: Icon }) => (
                            <span key={text} className={`inline-flex items-center gap-1 ${tone === "alert" ? "text-sent-unhappy-fg" : "text-sent-neutral-fg"}`}>
                              <Icon className="h-3 w-3" aria-hidden />
                              {text}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <ScoreChip score={r.rollingScore} decimals={1} provisional={r.rollingScore !== null && r.provisional} />
                    </td>
                    <td className={td}>
                      <CoverageBar coverage={r.coverage} compact />
                    </td>
                    <td className={td}>
                      <Sparkline cells={r.weekly} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums text-zinc-600 dark:text-zinc-400`}>
                      {r.daysSinceLastCall === null ? "Never" : r.daysSinceLastCall === 0 ? "Today" : `${r.daysSinceLastCall} d ago`}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      <span className={r.negativeMoments ? "font-medium text-sent-unhappy-fg" : "text-zinc-500"}>{r.negativeMoments}</span>
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </TableWrap>
          <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            PROV marks a score from fewer than {PROVISIONAL_BELOW} analysed calls. Quiet means no call in {QUIET_DAYS} days.
          </p>
        </Card>
      )}
    </>
  );
}
