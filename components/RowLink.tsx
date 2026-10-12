"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Table row that opens `href` on click; a real link inside the row keeps it keyboard accessible. */
export function RowLink({ href, className = "", children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer ${className}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
