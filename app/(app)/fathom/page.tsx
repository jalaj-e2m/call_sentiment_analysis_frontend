import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FathomSettings } from "@/components/FathomSettings";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import type { FathomAccount } from "@/lib/model";
import { QueryError, getFathomAccount } from "@/lib/queries";
import { getDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fathom" };

export default async function FathomPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "staff") redirect("/login");

  let account: FathomAccount | null = null;
  let loadError: string | null = null;
  try {
    account = await getFathomAccount(await getDb(), viewer.profile.id);
  } catch (error) {
    if (!(error instanceof QueryError)) throw error;
    loadError = error.message;
  }

  return (
    <>
      <PageHeader title="Fathom" subtitle="Connect your Fathom account and pull your latest calls in" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loadError ? (
            <Notice tone="error">
              {loadError}. If Fathom connect was just added, the database migration may not be applied yet.
            </Notice>
          ) : (
            <FathomSettings account={account} />
          )}
        </div>
        <Card title="How sync works">
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <li>The first sync imports your last 20 meetings. Later syncs import everything since the previous one.</li>
            <li>Only meetings with someone outside E2M become client calls. Internal meetings are skipped.</li>
            <li>
              New client calls are analysed automatically. Keep this tab open until it finishes; anything left shows an
              Analyze button on Calls.
            </li>
            <li>Calls that need manual analysis (long or multi-recording) are imported but not analysed automatically.</li>
            <li>Syncing twice is safe: calls already imported are skipped.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
