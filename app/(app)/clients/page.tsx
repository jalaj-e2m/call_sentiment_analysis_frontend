import Link from "next/link";
import { SentimentBadge } from "@/components/sentiment";
import { EmptyState, PageHeader, TableWrap, linkClass, td, th } from "@/components/ui";
import { getCallRows, getClients } from "@/lib/queries";
import { RECENT_DAYS, ROLLING_WINDOW, clientSummaries } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

const ARROWS = { up: "↑", down: "↓", flat: "→" } as const;
const ARROW_CLASS = { up: "text-emerald-600", down: "text-red-600", flat: "text-zinc-500" } as const;

export default async function ClientsPage() {
  const db = await getDb();
  const [clients, calls] = await Promise.all([getClients(db), getCallRows(db)]);
  const rows = clientSummaries(clients, calls, new Date());

  return (
    <>
      <PageHeader title="Clients" subtitle={`Rolling score = average of the last ${ROLLING_WINDOW} analysed calls`} />
      {rows.length === 0 ? (
        <EmptyState title="No clients yet." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Client</th>
              <th className={`${th} text-right`}>Calls</th>
              <th className={`${th} text-right`}>Analysed</th>
              <th className={th}>Latest</th>
              <th className={`${th} text-right`}>Rolling score</th>
              <th className={th}>Trend</th>
              <th className={`${th} text-right`}>Negative moments ({RECENT_DAYS} d)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.client.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className={td}>
                  <Link href={`/clients/${r.client.id}`} className={linkClass}>
                    {r.client.name}
                  </Link>
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.calls}</td>
                <td className={`${td} text-right tabular-nums`}>{r.analysed}</td>
                <td className={td}>{r.analysed ? <SentimentBadge label={r.latestLabel} /> : <span className="text-zinc-400">–</span>}</td>
                <td className={`${td} text-right tabular-nums`}>{r.rollingScore === null ? "–" : r.rollingScore.toFixed(1)}</td>
                <td className={td}>
                  {r.trend ? (
                    <span className={`font-semibold ${ARROW_CLASS[r.trend]}`} aria-label={`Trend ${r.trend}`}>
                      {ARROWS[r.trend]}
                    </span>
                  ) : (
                    <span className="text-zinc-400">–</span>
                  )}
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.negativeMomentsRecent}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
