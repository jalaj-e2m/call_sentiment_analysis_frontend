import { Card, EmptyState, Notice, PageHeader, TableWrap, td, th } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { formatDate } from "@/lib/sentiment";
import { getDb } from "@/lib/supabase/server";

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
        <Card title="Active prompt">
          {prompt ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-zinc-500">Name</dt>
              <dd>{prompt.name}</dd>
              <dt className="text-zinc-500">Version</dt>
              <dd>v{prompt.version}</dd>
              <dt className="text-zinc-500">Model</dt>
              <dd className="font-mono">{prompt.model}</dd>
              <dt className="text-zinc-500">Created</dt>
              <dd>{formatDate(prompt.createdAt)}</dd>
            </dl>
          ) : (
            <Notice tone="warning">No active sentiment prompt. Run npm run seed:prompt in the backend.</Notice>
          )}
        </Card>
        <Card title="App settings">
          {settings.length === 0 ? (
            <EmptyState title="No settings stored." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th className={th}>Key</th>
                  <th className={th}>Value</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.key}>
                    <td className={`${td} whitespace-nowrap font-mono text-xs`}>{s.key}</td>
                    <td className={td}>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
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
