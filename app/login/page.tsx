import { AudioLines } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { primaryButtonClass } from "@/components/ui";
import { SUPABASE_CONFIGURED, USE_FIXTURES } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <AudioLines className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Sign in to Call Sentiment</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Use the account you were invited with.</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {USE_FIXTURES ? (
            <div className="space-y-4 text-center text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">Fixture mode is on, so no login is needed.</p>
              <Link href="/" className={`${primaryButtonClass} w-full`}>
                Open the preview
              </Link>
            </div>
          ) : SUPABASE_CONFIGURED ? (
            <LoginForm />
          ) : (
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Supabase is not configured. Set the variables in .env.local.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
