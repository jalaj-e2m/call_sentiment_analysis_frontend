import { Plug, ShieldAlert, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell, SignOutButton } from "@/components/shell";
import { SyncProvider } from "@/components/sync";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { viewer, account, locked } = await getSession();
  if (viewer.kind === "anonymous") redirect("/login");

  if (viewer.kind === "no-access") {
    return (
      <Gate icon={ShieldAlert} title="No access" action={<SignOutButton variant="button" />}>
        Your account does not have access to call sentiment yet. Ask an admin to give you a role.
      </Gate>
    );
  }
  if (viewer.kind === "unconfigured") {
    return (
      <Gate icon={Plug} title="Supabase is not configured">
        Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. For a preview with fake data, leave
        them empty and set NEXT_PUBLIC_USE_FIXTURES=true.
      </Gate>
    );
  }

  const banner = viewer.fixtures ? (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      Preview with fake fixture data. Set the Supabase variables in .env.local to use real data.
    </div>
  ) : null;

  return (
    <SyncProvider account={account}>
      <AppShell profile={viewer.profile} locked={locked} banner={banner}>
        {children}
      </AppShell>
    </SyncProvider>
  );
}

function Gate({ icon: Icon, title, action, children }: { icon: LucideIcon; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </main>
  );
}
