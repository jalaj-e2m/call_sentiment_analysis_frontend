import { ChevronRight, Users } from "lucide-react";
import type { Person } from "@/lib/model";
import { surfaceClass } from "./ui";

const tagClass = "rounded px-1.5 py-0.5 text-[11px] font-medium";

/** Collapsed by default: who was invited to the meeting, from the Fathom calendar invite. */
export function MeetingPeople({ people }: { people: Person[] }) {
  const clients = people.filter((p) => p.side === "client").length;
  return (
    <details className={`${surfaceClass} group mb-6`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90" aria-hidden />
        <Users className="h-4 w-4 text-zinc-500" aria-hidden />
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">People in this meeting</span>
        <span className="text-zinc-500">
          {people.length === 0 ? "none recorded" : `${people.length} · ${clients} client${clients === 1 ? "" : "s"}`}
        </span>
      </summary>
      <div className="border-t border-zinc-100 dark:border-zinc-800">
        {people.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500">Fathom has no calendar invitees for this call.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {people.map((p) => (
              <li key={p.email ?? p.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <span className="min-w-40 font-medium text-zinc-900 dark:text-zinc-100">{p.name ?? "Unknown name"}</span>
                {p.email ? (
                  <a href={`mailto:${p.email}`} className="text-zinc-500 hover:text-indigo-600 hover:underline dark:hover:text-indigo-400">
                    {p.email}
                  </a>
                ) : (
                  <span className="text-zinc-400">No email</span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  {p.spoke ? (
                    <span className={`${tagClass} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`}>Spoke</span>
                  ) : null}
                  {p.recorder ? (
                    <span className={`${tagClass} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`}>Recorded</span>
                  ) : null}
                  <span
                    className={`${tagClass} ${
                      p.side === "client"
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {p.side === "client" ? "Client" : "E2M"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-zinc-100 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800">
          From the calendar invite in Fathom, so someone invited may not have joined. &quot;Spoke&quot; means their name
          appears in the transcript.
        </p>
      </div>
    </details>
  );
}
