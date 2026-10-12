"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { displayTitle, personName } from "@/lib/access";
import { rangeHref, type RangeKey } from "@/lib/analytics";
import type { Member } from "@/lib/model";

/** Admin only: narrow every chart, KPI and table on the page to one member's calls (?person=). */
export function PersonControl({ members, person, range, path }: { members: Member[]; person: Member | null; range: RangeKey; path: string }) {
  const [open, setOpen] = useState(false);
  const active = members.filter((m) => m.active);
  const item =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800";
  const mark = (on: boolean) => (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
      {on ? <Check className="h-3.5 w-3.5" /> : null}
    </span>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Person: ${person ? personName(person) : "everyone"}`}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
          person
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        <Users className="h-3.5 w-3.5 opacity-80" aria-hidden />
        <span className="max-w-36 truncate">{person ? personName(person) : "Everyone"}</span>
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 max-h-96 w-64 overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <nav aria-label="Show calls for">
            <Link href={rangeHref(path, range)} scroll={false} onClick={() => setOpen(false)} className={item} aria-current={person ? undefined : "true"}>
              {mark(!person)}
              <span className="font-medium">Everyone</span>
            </Link>
            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
            {active.map((m) => (
              <Link
                key={m.id}
                href={rangeHref(path, range, m.id)}
                scroll={false}
                onClick={() => setOpen(false)}
                className={item}
                aria-current={person?.id === m.id ? "true" : undefined}
              >
                {mark(person?.id === m.id)}
                <span className="min-w-0">
                  <span className="block truncate">{personName(m)}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{displayTitle(m)}</span>
                </span>
              </Link>
            ))}
          </nav>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
