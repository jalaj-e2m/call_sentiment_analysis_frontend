import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { CallsTable } from "@/components/CallsTable";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCallRows, getClients } from "@/lib/queries";
import { getDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calls" };

export default async function CallsPage() {
  const db = await getDb();
  const [calls, clients] = await Promise.all([getCallRows(db), getClients(db)]);
  return (
    <>
      <PageHeader title="Calls" subtitle="Client calls with their current analysis" />
      {calls.length === 0 ? (
        <EmptyState title="No client calls yet." icon={Inbox}>
          Connect Fathom and click Sync now in the sidebar to import your calls.
        </EmptyState>
      ) : (
        <CallsTable calls={calls} clients={clients} />
      )}
    </>
  );
}
