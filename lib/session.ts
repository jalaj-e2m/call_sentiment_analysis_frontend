import { redirect } from "next/navigation";
import { cache } from "react";
import { callsForPerson, clientsForCalls, isAdmin, needsSetup, parsePerson } from "./access";
import { getViewer, type Viewer } from "./auth";
import type { CallRow, ClientRow, FathomAccount, Member, Profile } from "./model";
import { getCallPeople, getCallRows, getClients, getFathomAccount, getMembers } from "./queries";
import { getDb, type Db } from "./supabase/server";

export interface Session {
  viewer: Viewer;
  account: FathomAccount | null;
  /** Executor or engineer who has not finished a first Fathom sync yet. */
  locked: boolean;
}

/** Once per request; the layout and the page both read it. */
export const getSession = cache(async (): Promise<Session> => {
  const viewer = await getViewer();
  if (viewer.kind !== "staff") return { viewer, account: null, locked: false };
  let account: FathomAccount | null = null;
  try {
    account = await getFathomAccount(await getDb(), viewer.profile.id);
  } catch {
    // The sidebar must not take every page down if the Fathom migration is not applied yet.
    account = null;
  }
  return { viewer, account, locked: needsSetup(viewer.profile, account) };
});

/**
 * For pages: the signed-in member, or null when the layout is already showing a gate (no
 * access, not configured) and the page should render nothing.
 */
export async function requireMember(): Promise<{ profile: Profile; db: Db | null; session: Session } | null> {
  const session = await getSession();
  if (session.viewer.kind === "anonymous") redirect("/login");
  if (session.viewer.kind !== "staff") return null;
  return { profile: session.viewer.profile, db: await getDb(), session };
}

/** Data pages: members who still need their first sync go to the Fathom setup page. */
export async function requireUnlocked() {
  const member = await requireMember();
  if (member?.session.locked) redirect("/fathom");
  return member;
}

export async function requireAdmin() {
  const member = await requireMember();
  if (member && !isAdmin(member.profile)) redirect("/");
  return member;
}

export interface Scope {
  calls: CallRow[];
  clients: ClientRow[];
  /** Admins only: everyone they can filter by (empty for others). */
  members: Member[];
  /** Admins only: the member chosen with ?person=, or null for everyone. */
  person: Member | null;
}

/**
 * Calls and clients for a data page. RLS already limits executors and engineers to their own;
 * admins can narrow to one member with ?person=<id>. If the RBAC migration is not applied yet,
 * the person filter is simply unavailable.
 */
export async function loadScope(db: Db | null, profile: Profile, personParam: string | string[] | undefined): Promise<Scope> {
  const [calls, clients] = await Promise.all([getCallRows(db), getClients(db)]);
  if (!isAdmin(profile)) return { calls, clients, members: [], person: null };
  let members: Member[] = [];
  try {
    members = await getMembers(db);
  } catch {
    return { calls, clients, members: [], person: null };
  }
  const personId = parsePerson(personParam, members.map((m) => m.id));
  if (!personId) return { calls, clients, members, person: null };
  try {
    const own = callsForPerson(calls, await getCallPeople(db), personId);
    return { calls: own, clients: clientsForCalls(clients, own), members, person: members.find((m) => m.id === personId) ?? null };
  } catch {
    return { calls, clients, members: [], person: null };
  }
}
