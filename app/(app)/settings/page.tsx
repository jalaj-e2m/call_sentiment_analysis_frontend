import { ChevronRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, EmptyState, Notice, PageHeader, surfaceClass } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { formatDate } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

interface Field {
  /** app_settings key, plus a property path inside its JSON value when the value is an object. */
  key: string;
  path?: string;
  label: string;
  description: string;
  unit?: string;
}

const SECTIONS: { title: string; description: string; fields: Field[] }[] = [
  {
    title: "Classification rules",
    description: "How an imported Fathom meeting is recognised as a client call.",
    fields: [
      {
        key: "classification_rules",
        path: "exclude_title_keywords",
        label: "Excluded title keywords",
        description: "Meetings whose title contains one of these are skipped, for example interviews.",
      },
      {
        key: "classification_rules",
        path: "client_title_keywords",
        label: "Client title keywords",
        description: "Without external attendees, a title containing one of these still counts as a client call.",
      },
    ],
  },
  {
    title: "Analysis policy",
    description: "When calls are analysed automatically.",
    fields: [
      {
        key: "analysis_policy",
        path: "manual_only_if_attendee_emails",
        label: "Manual-only attendees",
        description: "Calls with any of these people are never analysed automatically; they wait for someone to click Analyze.",
      },
    ],
  },
  {
    title: "Domains",
    description: "Which email addresses are staff and which are clients.",
    fields: [
      { key: "e2m_domains", label: "E2M domains", description: "Email domains of E2M staff. Everyone else on a call is treated as the client side." },
      {
        key: "public_email_domains",
        label: "Public email domains",
        description: "Personal email providers. Never used to match a call to a client company.",
      },
    ],
  },
  {
    title: "Limits",
    description: "Which recordings are imported and when two recordings are the same meeting.",
    fields: [
      { key: "call_duration_limits", path: "min_minutes", label: "Minimum length", description: "Shorter recordings are skipped.", unit: "min" },
      { key: "call_duration_limits", path: "max_minutes", label: "Maximum length", description: "Longer recordings are skipped.", unit: "min" },
      {
        key: "dedupe",
        path: "window_minutes",
        label: "Duplicate window",
        description: "Two recordings starting this close together can be the same meeting.",
        unit: "min",
      },
      {
        key: "dedupe",
        path: "min_attendee_overlap",
        label: "Duplicate attendee overlap",
        description: "Share of attendees (of the smaller list) that must match before recordings are merged into one call.",
      },
    ],
  },
];

function valueAt(settings: Map<string, unknown>, field: Field): unknown {
  const value = settings.get(field.key);
  if (!field.path) return value;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[field.path] : undefined;
}

function Value({ value, unit }: { value: unknown; unit?: string }): ReactNode {
  if (value === undefined || value === null) return <span className="text-xs text-zinc-500">Not set</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-xs text-zinc-500">None</span>;
    return (
      <ul className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <li
            key={`${String(v)}-${i}`}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            {typeof v === "string" ? v : JSON.stringify(v)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "number") {
    const text = unit ? `${value} ${unit}` : value > 0 && value <= 1 && !Number.isInteger(value) ? `${Math.round(value * 100)}%` : String(value);
    return <span className="font-mono text-sm tabular-nums">{text}</span>;
  }
  if (typeof value === "boolean") return <span className="text-sm">{value ? "Yes" : "No"}</span>;
  if (typeof value === "string") return <span className="font-mono text-sm">{value}</span>;
  return <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">{JSON.stringify(value, null, 2)}</pre>;
}

function Row({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 px-4 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</dt>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      <dd className="min-w-0 self-center">{children}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "staff" || viewer.profile.role !== "admin") {
    return (
      <>
        <PageHeader title="Settings" />
        <Notice tone="warning">Settings are visible to admins only.</Notice>
      </>
    );
  }

  const { settings, prompt } = await getSettings(await getDb());
  const byKey = new Map(settings.map((s) => [s.key, s.value]));
  const known = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));
  const others = settings.filter((s) => !known.has(s.key));

  return (
    <>
      <PageHeader title="Settings" subtitle="Read-only. Change values in the app_settings table in Supabase." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {settings.length === 0 ? <EmptyState title="No settings stored." /> : null}
          {SECTIONS.map((section) => (
            <Card key={section.title} title={section.title} description={section.description} flush>
              <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {section.fields.map((f) => (
                  <Row key={`${f.key}.${f.path ?? ""}`} label={f.label} description={f.description}>
                    <Value value={valueAt(byKey, f)} unit={f.unit} />
                  </Row>
                ))}
              </dl>
            </Card>
          ))}
          {others.length ? (
            <Card title="Other" description="Settings without a description yet." flush>
              <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {others.map((s) => (
                  <Row key={s.key} label={s.key} description="No description.">
                    <Value value={s.value} />
                  </Row>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-500" aria-hidden />
                Active prompt
              </span>
            }
            description="Used for every new analysis."
          >
            {prompt ? (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-zinc-600 dark:text-zinc-400">Name</dt>
                  <dd className="mt-0.5 font-medium">{prompt.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-600 dark:text-zinc-400">Version</dt>
                  <dd className="mt-0.5 font-medium">v{prompt.version}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-600 dark:text-zinc-400">Model</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{prompt.model}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-600 dark:text-zinc-400">Created</dt>
                  <dd className="mt-0.5">{formatDate(prompt.createdAt)}</dd>
                </div>
              </dl>
            ) : (
              <Notice tone="warning">No active sentiment prompt. Run npm run seed:prompt in the backend.</Notice>
            )}
          </Card>

          <details className={`${surfaceClass} group`}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-90" aria-hidden />
              Show raw
              <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400">app_settings as stored</span>
            </summary>
            <pre className="max-h-[60vh] overflow-auto border-t border-zinc-100 p-4 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              {JSON.stringify(Object.fromEntries(byKey), null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </>
  );
}
