"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const POLL_INTERVAL_MS = 5000;

/** Re-fetches the server-rendered page every 5 s while `active`. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
