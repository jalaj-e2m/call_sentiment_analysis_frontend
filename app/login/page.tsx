import Link from "next/link";
import { USE_FIXTURES } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call Sentiment</h1>
        <p className="mt-1 text-sm text-zinc-500">Sign in with the account you were invited with.</p>
      </div>
      {USE_FIXTURES ? (
        <p className="text-sm">
          Fixture mode is on, so no login is needed.{" "}
          <Link href="/" className="underline">
            Open the preview
          </Link>
          .
        </p>
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
