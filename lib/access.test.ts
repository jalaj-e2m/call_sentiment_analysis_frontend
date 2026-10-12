import { describe, expect, it } from "vitest";
import {
  callsForPerson,
  clientsForCalls,
  describeChange,
  displayTitle,
  isMember,
  memberRows,
  needsSetup,
  parsePerson,
  roleChangeWarning,
  toCallPeople,
} from "./access";
import { periodFor, periodWeeks, rangeHref } from "./analytics";
import { FIXTURE_MEMBERS, fixtureCallPeople, fixtureData, fixtureScope, fixtureViewer } from "./fixtures";
import type { CallRow, Member, UserChange } from "./model";

const NOW = new Date("2026-10-12T12:00:00Z");
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

const call = (id: string, clientId: string, daysAgo: number, score: number | null = null): CallRow => ({
  id,
  title: "Fake call",
  startedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  durationSeconds: 1800,
  clientId,
  clientName: `Client ${clientId}`,
  requiresManual: false,
  manualReason: null,
  manualLabel: null,
  status: score === null ? "not_started" : "done",
  error: null,
  analysis:
    score === null
      ? null
      : { id: `a-${id}`, score, label: score <= 4 ? "unhappy" : score <= 6 ? "neutral" : "happy", triggerSource: "auto", createdAt: NOW.toISOString(), moments: [] },
});

const member = (id: string, fullName: string, role: Member["role"], active = true): Member => ({
  id,
  fullName,
  email: `${fullName.toLowerCase()}@example-staff.com`,
  role,
  active,
  jobTitle: null,
  createdAt: null,
});

describe("roles", () => {
  it("lets active admins, executors and engineers in, nobody else", () => {
    expect(isMember({ role: "admin", active: true })).toBe(true);
    expect(isMember({ role: "executor", active: true })).toBe(true);
    expect(isMember({ role: "engineer", active: true })).toBe(true);
    expect(isMember({ role: "associate", active: true })).toBe(false);
    expect(isMember({ role: "engineer", active: false })).toBe(false);
    expect(isMember(null)).toBe(false);
  });

  it("locks executors and engineers until their first sync; admins never", () => {
    expect(needsSetup({ role: "admin" }, null)).toBe(false);
    expect(needsSetup({ role: "engineer" }, null)).toBe(true);
    expect(needsSetup({ role: "executor" }, { lastSyncAt: null })).toBe(true);
    expect(needsSetup({ role: "executor" }, { lastSyncAt: NOW.toISOString() })).toBe(false);
  });

  it("shows the job title, or the role when there is none", () => {
    expect(displayTitle({ role: "engineer", jobTitle: "Associate AI Engineer" })).toBe("Associate AI Engineer");
    expect(displayTitle({ role: "engineer", jobTitle: "  " })).toBe("Engineer");
    expect(displayTitle({ role: "specialist", jobTitle: null })).toBe("No access");
  });

  it("explains role changes in plain words", () => {
    expect(roleChangeWarning("Riya", "executor", "admin")).toMatch(/every call/);
    expect(roleChangeWarning("Riya", "admin", "engineer")).toMatch(/only see their own calls/);
    expect(roleChangeWarning("Riya", "engineer", "executor")).toBe("Change Riya from engineer to executor?");
  });

  it("describes audit entries", () => {
    const nameOf = (id: string | null) => (id === A ? "Riya" : "Unknown user");
    const base: UserChange = { id: 1, at: NOW.toISOString(), actorId: B, targetId: A, action: "user_role_changed", from: "engineer", to: "admin" };
    expect(describeChange(base, nameOf)).toBe("Riya: engineer → admin");
    expect(describeChange({ ...base, action: "user_title_changed", to: "AI Executor" }, nameOf)).toBe('Riya: title set to "AI Executor"');
    expect(describeChange({ ...base, action: "user_title_changed", to: null }, nameOf)).toBe("Riya: title cleared");
    expect(describeChange({ ...base, action: "user_deactivated" }, nameOf)).toBe("Riya: deactivated");
  });
});

describe("person scoping", () => {
  const calls = [call("k1", "c1", 1, 8), call("k2", "c2", 2, 3), call("k3", "c3", 40, 5)];
  const people = toCallPeople([
    { call_id: "k1", user_id: A },
    { call_id: "k1", user_id: A },
    { call_id: "k1", user_id: B },
    { call_id: "k2", user_id: B },
  ]);

  it("groups call owners without duplicates", () => {
    expect(people.get("k1")).toEqual([A, B]);
    expect(people.get("k3")).toBeUndefined();
  });

  it("filters calls and clients to one member", () => {
    expect(callsForPerson(calls, people, null)).toHaveLength(3);
    expect(callsForPerson(calls, people, A).map((c) => c.id)).toEqual(["k1"]);
    expect(callsForPerson(calls, people, B).map((c) => c.id)).toEqual(["k1", "k2"]);
    const clients = ["c1", "c2", "c3"].map((id) => ({ id, name: id, status: "active" }));
    expect(clientsForCalls(clients, callsForPerson(calls, people, B)).map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("accepts only known members as ?person=", () => {
    expect(parsePerson(A, [A, B])).toBe(A);
    expect(parsePerson([B, A], [A, B])).toBe(B);
    expect(parsePerson("someone-else", [A, B])).toBeNull();
    expect(parsePerson(undefined, [A])).toBeNull();
  });

  it("keeps the person in links next to the range", () => {
    expect(rangeHref("/", "30", A)).toBe(`/?person=${A}`);
    expect(rangeHref("/clients", "90", A)).toBe(`/clients?range=90&person=${A}`);
    expect(rangeHref("/calls?manual=1", "30", null)).toBe("/calls?manual=1");
  });

  it("builds one row per member: active first, then role, then name", () => {
    const members = [member(B, "Zed", "engineer"), member(A, "Amy", "executor"), member("x", "Old", "admin", false)];
    const p = periodFor("30", NOW);
    const rows = memberRows(members, [{ ownerId: A, connected: true, syncStatus: "idle", lastSyncAt: null }], calls, people, p, periodWeeks(p, calls));
    expect(rows.map((r) => r.member.fullName)).toEqual(["Amy", "Zed", "Old"]);
    expect(rows[0]!.account?.connected).toBe(true);
    expect(rows[1]!.account).toBeNull();
    const zed = rows[1]!;
    expect(zed.totalCalls).toBe(2);
    expect(zed.kpis.analysed).toBe(2);
    expect(zed.kpis.unhappy).toBe(1);
    expect(zed.kpis.averageScore).toBe(5.5);
    expect(zed.lastCallAt).toBe(calls[0]!.startedAt);
    expect(rows[2]!.totalCalls).toBe(0);
  });
});

describe("fixture previews", () => {
  it("gives every fixture call at least one member", () => {
    const { calls } = fixtureData();
    const people = fixtureCallPeople(calls);
    expect(calls.every((c) => (people.get(c.id)?.length ?? 0) > 0)).toBe(true);
    expect(FIXTURE_MEMBERS.filter((m) => !m.active)).toHaveLength(1);
  });

  it("shows executors and engineers only their own calls and clients", () => {
    const all = fixtureScope("");
    const eng = fixtureScope("engineer");
    const { profile } = fixtureViewer("engineer");
    const people = fixtureCallPeople(all.calls);
    expect(eng.calls.length).toBeGreaterThan(0);
    expect(eng.calls.length).toBeLessThan(all.calls.length);
    expect(eng.calls.every((c) => people.get(c.id)?.includes(profile.id))).toBe(true);
    expect(eng.clients.every((cl) => eng.calls.some((c) => c.clientId === cl.id))).toBe(true);
    expect([...eng.details.keys()].every((id) => eng.calls.some((c) => c.id === id))).toBe(true);
  });

  it("previews a new engineer as locked", () => {
    const { profile, account } = fixtureViewer("new");
    expect(profile.role).toBe("engineer");
    expect(needsSetup(profile, account)).toBe(true);
    expect(needsSetup(fixtureViewer("").profile, fixtureViewer("").account)).toBe(false);
  });
});
