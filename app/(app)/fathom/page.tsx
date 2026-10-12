import { CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FathomSettings } from "@/components/FathomSettings";
import { Card, Notice, PageHeader, primaryButtonClass } from "@/components/ui";
import { isAdmin } from "@/lib/access";
import type { FathomAccount } from "@/lib/model";
import { QueryError, getFathomAccount } from "@/lib/queries";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Fathom" };

function Step({ done, n, title, children }: { done: boolean; n: number; title: string; children: React.ReactNode }) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <li className="flex gap-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${done ? "text-sent-happy" : "text-zinc-400"}`} aria-hidden />
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          <span className="sr-only">{done ? "Done: " : "To do: "}</span>
          {n}. {title}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
      </div>
    </li>
  );
}

export default async function FathomPage() {
  const member = await requireMember();
  if (!member) return null;
  const { profile, db, session } = member;

  let account: FathomAccount | null = null;
  let loadError: string | null = null;
  try {
    account = await getFathomAccount(db, profile.id);
  } catch (error) {
    if (!(error instanceof QueryError)) throw error;
    loadError = error.message;
  }
  const justUnlocked = !session.locked && !isAdmin(profile) && account?.lastSyncResult?.first_sync === true;

  return (
    <>
      <PageHeader
        title={session.locked ? "Set up your workspace" : "Fathom"}
        subtitle={
          session.locked
            ? "Connect Fathom and sync once. Your dashboard, calls and clients unlock after the first sync."
            : "Connect your Fathom account and pull your latest calls in"
        }
      />
      {session.locked ? (
        <Card className="mb-6">
          <ol className="grid gap-4 md:grid-cols-3">
            <Step n={1} done={!!account?.connected} title="Connect Fathom">
              Paste your Fathom API key below.
            </Step>
            <Step n={2} done={!!account?.lastSyncAt} title="Sync your calls">
              Click Sync now. The first sync imports your last 20 meetings.
            </Step>
            <Step n={3} done={false} title="See your dashboard">
              You will see the client calls you recorded or were invited to, and those clients.
            </Step>
          </ol>
        </Card>
      ) : null}
      {justUnlocked ? (
        <div className="mb-6">
          <Notice tone="success">
            First sync done. Your dashboard is ready.{" "}
            <Link href="/" className={`${primaryButtonClass} ml-2 align-middle`}>
              Open dashboard
            </Link>
          </Notice>
        </div>
      ) : null}
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
              {isAdmin(profile)
                ? "You see every call. Executors and engineers see the calls they recorded or were invited to."
                : "You see the client calls you recorded or were invited to. If a colleague recorded the same meeting, it still shows up once."}
            </li>
            <li>
              New client calls are analysed automatically. Keep this tab open until it finishes; anything left shows an
              Analyze button on Calls.
            </li>
            <li>Manual-only calls are imported but not analysed automatically; open one and click Analyze. Everyone on the call sees the same analysis.</li>
            <li>Syncing twice is safe: calls already imported are skipped.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
