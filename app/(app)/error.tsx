"use client";

import { Notice, buttonClass } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-12">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <Notice tone="error">{error.message || "The page could not be loaded."}</Notice>
      <button type="button" className={buttonClass} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
