import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { CallsTable } from "@/components/CallsTable";
import { ViewControls } from "@/components/controls";
import { EmptyState, PageHeader } from "@/components/ui";
import { isAdmin, personName } from "@/lib/access";
import { parseRange } from "@/lib/analytics";
import { loadScope, requireUnlocked } from "@/lib/session";

export const metadata: Metadata = { title: "Calls" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** ?client=<id>,<id>&label=unhappy&status=failed&manual=1 pre-sets the filters (dashboard links). */
const list = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? [value] : []).flatMap((v) => v.split(",")).filter(Boolean);

export default async function CallsPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireUnlocked();
  if (!member) return null;
  const params = await searchParams;
  const { calls, clients, members, person } = await loadScope(member.db, member.profile, params.person);
  const admin = isAdmin(member.profile);
  const whose = person ? `${personName(person)}'s client calls` : admin ? "Client calls" : "Your client calls";
  return (
    <>
      <PageHeader
        title="Calls"
        subtitle={`${whose} with their current analysis. Click a row to open it.`}
        actions={<ViewControls range={parseRange(params.range)} path="/calls" members={members} person={person} showRange={false} />}
      />
      {calls.length === 0 ? (
        <EmptyState title={person ? `No client calls for ${personName(person)}.` : "No client calls yet."} icon={Inbox}>
          Connect Fathom and click Sync now in the sidebar to import your calls.
        </EmptyState>
      ) : (
        <CallsTable
          calls={calls}
          clients={clients}
          initial={{
            clients: list(params.client),
            labels: list(params.label),
            statuses: list(params.status),
            manualOnly: params.manual === "1",
          }}
        />
      )}
    </>
  );
}
