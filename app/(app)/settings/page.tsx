import type { Metadata } from "next";
import { Card, EmptyState, Notice, PageHeader, TableWrap, rowClass, td, th } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { formatDate } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

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
  return (
    <>
      <PageHeader title="Settings" subtitle="Read-only in this version" />
      <div className="space-y-6">
        <Card title="Active prompt" description="Used for every new analysis">
          {prompt ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-zinc-500">Name</dt>
                <dd className="mt-0.5 font-medium">{prompt.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Version</dt>
                <dd className="mt-0.5 font-medium">v{prompt.version}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Model</dt>
                <dd className="mt-0.5 font-mono text-xs">{prompt.model}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Created</dt>
                <dd className="mt-0.5">{formatDate(prompt.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            <Notice tone="warning">No active sentiment prompt. Run npm run seed:prompt in the backend.</Notice>
          )}
        </Card>
        <Card title="App settings" flush>
          {settings.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No settings stored." />
            </div>
          ) : (
            <TableWrap minWidth={560}>
              <thead>
                <tr>
                  <th className={th}>Key</th>
                  <th className={th}>Value</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.key} className={rowClass}>
                    <td className={`${td} whitespace-nowrap align-top font-mono text-xs`}>{s.key}</td>
                    <td className={td}>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {JSON.stringify(s.value, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
