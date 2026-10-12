"use client";

import { Check, LayoutDashboard, Pencil, ShieldAlert, UserCheck, UserX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { updateUser, type UserUpdate } from "@/app/(app)/users/actions";
import {
  MAX_JOB_TITLE,
  MEMBER_ROLES,
  ROLE_LABELS,
  isMemberRole,
  personName,
  roleChangeWarning,
  roleLabel,
  type MemberRole,
  type MemberRow,
} from "@/lib/access";
import { rangeHref, type RangeKey } from "@/lib/analytics";
import { formatRelative } from "@/lib/sentiment";
import { SegmentedControl } from "./controls";
import { ScoreChip } from "./sentiment";
import { Notice, TableWrap, buttonClass, dangerButtonClass, inputClass, primaryButtonClass, rowClass, smallButtonClass, td, th } from "./ui";
import { CoverageBar } from "./viz";

interface Pending {
  update: UserUpdate;
  message: string;
  danger: boolean;
}

const ROLE_OPTIONS = MEMBER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function FathomStatus({ row, now }: { row: MemberRow; now: Date }) {
  const a = row.account;
  if (!a?.connected) return <span className="text-xs text-zinc-500 dark:text-zinc-400">Not connected</span>;
  if (a.syncStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-sent-unhappy-fg">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
        Last sync failed
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-600 dark:text-zinc-400">
      {a.lastSyncAt ? `Synced ${formatRelative(a.lastSyncAt, now)}` : "Connected, never synced"}
    </span>
  );
}

function TitleCell({ row, busy, onSave }: { row: MemberRow; busy: boolean; onSave: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.member.jobTitle ?? "");
  const name = personName(row.member);
  if (!editing) {
    return (
      <span className="group flex items-center gap-1.5">
        <span className={`truncate ${row.member.jobTitle ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400"}`}>
          {row.member.jobTitle || "No title"}
        </span>
        <button
          type="button"
          className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label={`Edit job title for ${name}`}
          onClick={() => {
            setValue(row.member.jobTitle ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3" aria-hidden />
        </button>
      </span>
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(value);
    setEditing(false);
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        maxLength={MAX_JOB_TITLE}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        aria-label={`Job title for ${name}`}
        placeholder="e.g. AI Engineer"
        className={`${inputClass} h-7 w-44 py-0 text-xs`}
      />
      <button type="submit" disabled={busy} className={smallButtonClass} aria-label="Save title">
        <Check className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" onClick={() => setEditing(false)} className={smallButtonClass} aria-label="Cancel">
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </form>
  );
}

/** Admin user management: role, job title and access per person, with confirmation for access changes. */
export function UsersTable({ rows, selfId, range, nowIso }: { rows: MemberRow[]; selfId: string; range: RangeKey; nowIso: string }) {
  const router = useRouter();
  const now = new Date(nowIso);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const base = (row: MemberRow): UserUpdate => ({
    userId: row.member.id,
    role: row.member.role,
    jobTitle: row.member.jobTitle ?? "",
    active: row.member.active,
  });

  function run(update: UserUpdate, done: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateUser(update);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPending(null);
      setNotice(done);
      router.refresh();
    });
  }

  function askRole(row: MemberRow, to: MemberRole) {
    if (to === row.member.role) return;
    setError(null);
    setPending({
      update: { ...base(row), role: to },
      message: roleChangeWarning(personName(row.member), row.member.role, to),
      danger: row.member.role === "admin" || to === "admin",
    });
  }

  function askActive(row: MemberRow) {
    const name = personName(row.member);
    setError(null);
    setPending({
      update: { ...base(row), active: !row.member.active },
      message: row.member.active
        ? `Deactivate ${name}? They lose access immediately and see "No access" on their next page load.`
        : `Reactivate ${name} as ${roleLabel(row.member.role).toLowerCase()}?`,
      danger: row.member.active,
    });
  }

  return (
    <div className="space-y-3">
      {pending ? (
        <div
          role="alertdialog"
          aria-labelledby="user-change-message"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <p id="user-change-message" className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
            {pending.message}
          </p>
          <span className="flex items-center gap-2">
            <button type="button" className={buttonClass} onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              autoFocus
              className={pending.danger ? dangerButtonClass : primaryButtonClass}
              onClick={() => run(pending.update, "Saved. The change applies on their next page load.")}
              disabled={busy}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
          </span>
        </div>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice && !error ? <Notice tone="success">{notice}</Notice> : null}

      <TableWrap minWidth={1100}>
        <thead>
          <tr>
            <th className={th} scope="col">
              Person
            </th>
            <th className={th} scope="col">
              Role
            </th>
            <th className={th} scope="col">
              Job title
            </th>
            <th className={th} scope="col">
              Fathom
            </th>
            <th className={`${th} text-right`} scope="col">
              Analysed
            </th>
            <th className={th} scope="col">
              Coverage
            </th>
            <th className={th} scope="col">
              Avg score
            </th>
            <th className={`${th} text-right`} scope="col">
              Unhappy
            </th>
            <th className={th} scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const m = row.member;
            const self = m.id === selfId;
            const name = personName(m);
            return (
              <tr key={m.id} className={`${rowClass} ${m.active ? "" : "opacity-60"}`}>
                <td className={`${td} max-w-64`}>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
                    {self ? <span className="rounded bg-zinc-100 px-1 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">You</span> : null}
                    {!m.active ? (
                      <span className="rounded border border-zinc-300 px-1 text-[10px] font-medium uppercase text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                        Inactive
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">{m.email}</span>
                </td>
                <td className={td}>
                  {isMemberRole(m.role) ? (
                    <SegmentedControl
                      label={`Role for ${name}`}
                      value={m.role}
                      options={ROLE_OPTIONS}
                      onChange={(to) => askRole(row, to)}
                      disabled={self || busy}
                    />
                  ) : (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{roleLabel(m.role)}</span>
                  )}
                  {self ? <span className="sr-only">You cannot change your own role.</span> : null}
                </td>
                <td className={`${td} max-w-56 text-sm`}>
                  <TitleCell
                    key={m.jobTitle ?? ""}
                    row={row}
                    busy={busy}
                    onSave={(title) => {
                      if (title.trim() !== (m.jobTitle ?? "")) run({ ...base(row), jobTitle: title }, "Title saved.");
                    }}
                  />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <FathomStatus row={row} now={now} />
                </td>
                <td className={`${td} text-right tabular-nums text-zinc-800 dark:text-zinc-200`}>
                  {row.kpis.analysed}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400"> / {row.totalCalls} total</span>
                </td>
                <td className={td}>
                  <CoverageBar coverage={row.kpis.coverage} compact />
                </td>
                <td className={td}>
                  <ScoreChip score={row.kpis.averageScore} decimals={1} />
                </td>
                <td className={`${td} text-right tabular-nums ${row.kpis.unhappy ? "font-semibold text-sent-unhappy-fg" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {row.kpis.unhappy}
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <span className="inline-flex items-center gap-1.5">
                    {m.active && row.totalCalls > 0 ? (
                      <Link href={rangeHref("/", range, m.id)} className={smallButtonClass} aria-label={`Open ${name}'s dashboard`} title="Open their dashboard">
                        <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    ) : null}
                    {self ? null : (
                      <button
                        type="button"
                        className={smallButtonClass}
                        onClick={() => askActive(row)}
                        disabled={busy}
                        aria-label={m.active ? `Deactivate ${name}` : `Reactivate ${name}`}
                        title={m.active ? "Deactivate" : "Reactivate"}
                      >
                        {m.active ? <UserX className="h-3.5 w-3.5" aria-hidden /> : <UserCheck className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
