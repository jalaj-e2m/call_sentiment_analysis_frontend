/**
 * Roles and per-person scoping. Pure (no I/O); the database enforces the same rules with RLS,
 * this only shapes what the UI shows. Unit-tested in access.test.ts.
 */
import { periodKpis, type Period, type PeriodKpis, type Week } from "./analytics";
import type { AppRole, CallPeople, CallRow, ClientRow, FathomAccount, Member, MemberAccount, Profile, UserChange } from "./model";

export const MEMBER_ROLES = ["admin", "executor", "engineer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = { admin: "Admin", executor: "Executor", engineer: "Engineer" };

export const ROLE_ACCESS: Record<MemberRole, string> = {
  admin: "every call and client, plus users and settings",
  executor: "only their own calls and those clients",
  engineer: "only their own calls and those clients",
};

export const MAX_JOB_TITLE = 80;

export const isMemberRole = (role: string): role is MemberRole => (MEMBER_ROLES as readonly string[]).includes(role);

export const isMember = (profile: Pick<Profile, "role" | "active"> | null): boolean =>
  !!profile && profile.active && isMemberRole(profile.role);

export const isAdmin = (profile: Pick<Profile, "role">): boolean => profile.role === "admin";

export const roleLabel = (role: AppRole): string => (isMemberRole(role) ? ROLE_LABELS[role] : "No access");

/** Job title when set, otherwise the role. */
export const displayTitle = (profile: Pick<Profile, "role" | "jobTitle">): string => profile.jobTitle?.trim() || roleLabel(profile.role);

/** Executors and engineers see their data only after their first successful Fathom sync. */
export const needsSetup = (profile: Pick<Profile, "role">, account: Pick<FathomAccount, "lastSyncAt"> | null): boolean =>
  !isAdmin(profile) && !account?.lastSyncAt;

/** Manual-only calls are analysed by admins. */
export const canAnalyzeManual = (role: AppRole): boolean => role === "admin";

export const personName = (m: Pick<Profile, "fullName" | "email">): string => m.fullName?.trim() || m.email;

/** The ?person= value when it names a known member, else null (everyone). */
export function parsePerson(value: string | string[] | undefined, memberIds: string[]): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && memberIds.includes(v) ? v : null;
}

export function toCallPeople(rows: { call_id: string; user_id: string }[]): CallPeople {
  const map: CallPeople = new Map();
  for (const { call_id, user_id } of rows) {
    const list = map.get(call_id) ?? [];
    if (!list.includes(user_id)) list.push(user_id);
    map.set(call_id, list);
  }
  return map;
}

/** One member's calls, or every call when person is null. */
export const callsForPerson = (calls: CallRow[], people: CallPeople, person: string | null): CallRow[] =>
  person === null ? calls : calls.filter((c) => people.get(c.id)?.includes(person));

/** Clients that appear on these calls, in the original order. */
export function clientsForCalls(clients: ClientRow[], calls: CallRow[]): ClientRow[] {
  const ids = new Set(calls.map((c) => c.clientId));
  return clients.filter((c) => ids.has(c.id));
}

export interface MemberRow {
  member: Member;
  account: MemberAccount | null;
  /** Calls belonging to the member, all time. */
  totalCalls: number;
  kpis: PeriodKpis;
  lastCallAt: string | null;
}

const ROLE_ORDER: Record<string, number> = { admin: 0, executor: 1, engineer: 2 };

/** One row per member for the Users page: active first, then by role, then by name. */
export function memberRows(
  members: Member[],
  accounts: MemberAccount[],
  calls: CallRow[],
  people: CallPeople,
  p: Period,
  weeks: Week[],
): MemberRow[] {
  return members
    .map((member) => {
      const own = callsForPerson(calls, people, member.id);
      const latest = own.reduce<string | null>((acc, c) => (c.startedAt && (!acc || c.startedAt > acc) ? c.startedAt : acc), null);
      return {
        member,
        account: accounts.find((a) => a.ownerId === member.id) ?? null,
        totalCalls: own.length,
        kpis: periodKpis(own, p, weeks),
        lastCallAt: latest,
      };
    })
    .sort(
      (a, b) =>
        Number(b.member.active) - Number(a.member.active) ||
        (ROLE_ORDER[a.member.role] ?? 9) - (ROLE_ORDER[b.member.role] ?? 9) ||
        personName(a.member).localeCompare(personName(b.member)),
    );
}

/** "Made Riya an admin", "Changed Aman's title to AI Engineer", ... for the change history. */
export function describeChange(change: UserChange, nameOf: (id: string | null) => string): string {
  const target = nameOf(change.targetId);
  switch (change.action) {
    case "user_role_changed": {
      const to = change.to && isMemberRole(change.to) ? ROLE_LABELS[change.to].toLowerCase() : (change.to ?? "unknown");
      const from = change.from && isMemberRole(change.from) ? ROLE_LABELS[change.from].toLowerCase() : (change.from ?? "unknown");
      return `${target}: ${from} → ${to}`;
    }
    case "user_title_changed":
      return change.to ? `${target}: title set to "${change.to}"` : `${target}: title cleared`;
    case "user_deactivated":
      return `${target}: deactivated`;
    case "user_reactivated":
      return `${target}: reactivated`;
  }
}

/** What confirming a role change means, in one sentence. */
export function roleChangeWarning(name: string, from: AppRole, to: MemberRole): string {
  if (to === "admin") return `Make ${name} an admin? They will see every call and client and can manage users.`;
  if (from === "admin") return `Remove admin access from ${name}? They will only see their own calls.`;
  return `Change ${name} from ${roleLabel(from).toLowerCase()} to ${ROLE_LABELS[to].toLowerCase()}?`;
}
