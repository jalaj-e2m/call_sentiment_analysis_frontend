"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice, inputClass, primaryButtonClass } from "@/components/ui";
import { getBrowserDb } from "@/lib/supabase/browser";

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
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="submit" disabled={busy} className={`${primaryButtonClass} h-9 w-full`}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
