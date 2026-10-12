import { USE_FIXTURES } from "./env";
import { FIXTURE_PROFILE } from "./fixtures";
import type { Profile } from "./model";
import { getDb } from "./supabase/server";

export const STAFF_ROLES = ["admin", "specialist", "associate"] as const;

export type Viewer =
  | { kind: "anonymous" }
  | { kind: "no-access" }
  | { kind: "unconfigured" }
  | { kind: "staff"; profile: Profile; fixtures: boolean };

export const isStaff = (profile: Pick<Profile, "role" | "active"> | null): boolean =>
  !!profile && profile.active && (STAFF_ROLES as readonly string[]).includes(profile.role);

/** The signed-in user's profile. Engineers, inactive users and users without a profile get no access. */
export async function getViewer(): Promise<Viewer> {
  const db = await getDb();
  if (!db) return USE_FIXTURES ? { kind: "staff", profile: FIXTURE_PROFILE, fixtures: true } : { kind: "unconfigured" };

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { kind: "anonymous" };

  const { data } = await db.from("profiles").select("id, full_name, email, role, active").eq("id", user.id).maybeSingle();
  const profile: Profile | null = data
    ? { id: data.id, fullName: data.full_name, email: data.email, role: data.role, active: data.active }
    : null;
  return profile && isStaff(profile) ? { kind: "staff", profile, fixtures: false } : { kind: "no-access" };
}
