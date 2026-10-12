import { CallsTable } from "@/components/CallsTable";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCallRows, getClients } from "@/lib/queries";
import { getDb } from "@/lib/supabase/server";

export default async function CallsPage() {
  const db = await getDb();
  const [calls, clients] = await Promise.all([getCallRows(db), getClients(db)]);
  return (
    <>
      <PageHeader title="Calls" subtitle="Client calls with their current analysis" />
      {calls.length === 0 ? <EmptyState title="No client calls yet." /> : <CallsTable calls={calls} clients={clients} />}
    </>
  );
}
