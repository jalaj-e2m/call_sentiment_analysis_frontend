"use client";

import { RotateCw } from "lucide-react";
import { Notice, PageHeader, buttonClass } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg">
      <PageHeader title="Something went wrong" />
      <Notice tone="error">{error.message || "The page could not be loaded."}</Notice>
      <button type="button" className={`${buttonClass} mt-4`} onClick={reset}>
        <RotateCw className="h-3.5 w-3.5" aria-hidden />
        Try again
      </button>
    </div>
  );
}
