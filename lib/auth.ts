import { isMember } from "./access";
import { FIXTURE_ROLE, USE_FIXTURES } from "./env";
import { fixtureViewer } from "./fixtures";
import type { Profile } from "./model";
import { toProfile } from "./queries";
import { getDb } from "./supabase/server";

export type Viewer =
  | { kind: "anonymous" }
  | { kind: "no-access" }
  | { kind: "unconfigured" }
  | { kind: "staff"; profile: Profile; fixtures: boolean };

/** The signed-in user's profile. Inactive users, retired roles and users without a profile get no access. */
export async function getViewer(): Promise<Viewer> {
  const db = await getDb();
  if (!db) return USE_FIXTURES ? { kind: "staff", profile: fixtureViewer(FIXTURE_ROLE).profile, fixtures: true } : { kind: "unconfigured" };

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { kind: "anonymous" };

  const { data } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profile: Profile | null = data ? toProfile(data) : null;
  return profile && isMember(profile) ? { kind: "staff", profile, fixtures: false } : { kind: "no-access" };
}
