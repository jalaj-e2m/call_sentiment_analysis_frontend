import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell, SignOutButton } from "@/components/shell";
import { SyncProvider } from "@/components/sync";
import { getViewer } from "@/lib/auth";
import type { FathomAccount } from "@/lib/model";
import { getFathomAccount } from "@/lib/queries";
import { getDb } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") redirect("/login");

  if (viewer.kind === "no-access") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">No access</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Your account does not have access to call sentiment. Ask an admin if you think this is wrong.
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton variant="button" />
          </div>
        </div>
      </main>
    );
  }

  // The sidebar must not take every page down if the Fathom migration is not applied yet.
  let account: FathomAccount | null = null;
  try {
    account = await getFathomAccount(await getDb(), viewer.profile.id);
  } catch {
    account = null;
  }

  const banner = viewer.fixtures ? (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      Preview with fake fixture data. Set the Supabase variables in .env.local to use real data.
    </div>
  ) : null;

  return (
    <SyncProvider account={account}>
      <AppShell profile={viewer.profile} banner={banner}>
        {children}
      </AppShell>
    </SyncProvider>
  );
}
