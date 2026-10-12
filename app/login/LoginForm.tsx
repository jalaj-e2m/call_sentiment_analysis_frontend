"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { getBrowserDb } from "@/lib/supabase/browser";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getBrowserDb();
    if (!db) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const { error: signInError } = await db.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setBusy(false);
    if (signInError) {
      setError("Email or password is incorrect.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm">
        Email
        <input name="email" type="email" autoComplete="email" required className={`mt-1 ${inputClass}`} />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={`mt-1 ${inputClass}`} />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
