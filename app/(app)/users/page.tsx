import { History, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { RangeControl } from "@/components/controls";
import { UsersTable } from "@/components/UsersTable";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { MEMBER_ROLES, ROLE_ACCESS, ROLE_LABELS, describeChange, memberRows, personName } from "@/lib/access";
import { parseRange, periodFor, periodPhrase, periodWeeks } from "@/lib/analytics";
import type { UserChange } from "@/lib/model";
import { QueryError, getCallPeople, getCallRows, getMemberAccounts, getMembers, getUserChanges } from "@/lib/queries";
import { formatRelative } from "@/lib/sentiment";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Users" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireAdmin();
  if (!member) return null;
  const range = parseRange((await searchParams).range);
  const header = (
    <PageHeader
      title="Users"
      subtitle={`Roles, job titles and access. Call numbers cover ${periodPhrase(range)}.`}
      actions={<RangeControl range={range} path="/users" />}
    />
  );

  let data;
  try {
    const [members, accounts, people, calls, changes] = await Promise.all([
      getMembers(member.db),
      getMemberAccounts(member.db),
      getCallPeople(member.db),
      getCallRows(member.db),
      getUserChanges(member.db),
    ]);
    data = { members, accounts, people, calls, changes };
  } catch (error) {
    if (!(error instanceof QueryError)) throw error;
    return (
      <>
        {header}
        <Notice tone="error">
          {error.message}. If roles were just added, apply the backend migrations first (npx supabase db push).
        </Notice>
      </>
    );
  }

  const now = new Date();
  const p = periodFor(range, now);
  const rows = memberRows(data.members, data.accounts, data.calls, data.people, p, periodWeeks(p, data.calls));
  const nameOf = (id: string | null) => {
    const m = data.members.find((x) => x.id === id);
    return m ? personName(m) : "Unknown user";
  };

  return (
    <>
      {header}
      <div className="space-y-6">
        {rows.length === 0 ? (
          <EmptyState title="No users yet." icon={UsersRound} />
        ) : (
          <UsersTable rows={rows} selfId={member.profile.id} range={range} nowIso={now.toISOString()} />
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="What each role sees">
            <dl className="space-y-3 text-sm">
              {MEMBER_ROLES.map((role) => (
                <div key={role}>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-100">{ROLE_LABELS[role]}</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">Sees {ROLE_ACCESS[role]}.</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              New sign-ups with a company email start as engineers. Executors and engineers see their data after their
              first Fathom sync. You cannot change your own role.
            </p>
          </Card>
          <Card title="Recent changes" flush>
            <ChangeList changes={data.changes} nameOf={nameOf} now={now} />
          </Card>
        </div>
      </div>
    </>
  );
}

function ChangeList({ changes, nameOf, now }: { changes: UserChange[]; nameOf: (id: string | null) => string; now: Date }) {
  if (changes.length === 0) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        <History className="h-4 w-4" aria-hidden />
        No changes yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {changes.map((c) => (
        <li key={c.id} className="px-4 py-2 text-sm">
          <p className="text-zinc-900 dark:text-zinc-100">{describeChange(c, nameOf)}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            by {nameOf(c.actorId)} · {formatRelative(c.at, now)}
          </p>
        </li>
      ))}
    </ul>
  );
}
