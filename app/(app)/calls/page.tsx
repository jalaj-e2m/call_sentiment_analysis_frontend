import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { CallsTable } from "@/components/CallsTable";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCallRows, getClients } from "@/lib/queries";
import { getDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calls" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** ?client=<id>,<id>&label=unhappy&status=failed&manual=1 pre-sets the filters (dashboard links). */
const list = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? [value] : []).flatMap((v) => v.split(",")).filter(Boolean);

export default async function CallsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const db = await getDb();
  const [calls, clients] = await Promise.all([getCallRows(db), getClients(db)]);
  return (
    <>
      <PageHeader title="Calls" subtitle="Client calls with their current analysis. Click a row to open it." />
      {calls.length === 0 ? (
        <EmptyState title="No client calls yet." icon={Inbox}>
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
