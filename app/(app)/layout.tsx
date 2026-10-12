import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav, SignOutButton, ThemeToggle } from "@/components/shell";
import { getViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") redirect("/login");

  if (viewer.kind === "no-access") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">No access</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your account does not have access to call sentiment. Ask an admin if you think this is wrong.
        </p>
        <SignOutButton />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {viewer.fixtures ? (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          Preview with fake fixture data. Set the Supabase variables in .env.local to use real data.
        </div>
      ) : null}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="mr-2 font-semibold tracking-tight">
            Call Sentiment
          </Link>
          <Nav isAdmin={viewer.profile.role === "admin"} />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-zinc-500 sm:inline">{viewer.profile.fullName ?? viewer.profile.email}</span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
