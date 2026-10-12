"use server";

import { revalidatePath } from "next/cache";
import { MAX_JOB_TITLE, isAdmin, isMemberRole } from "@/lib/access";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UserUpdate {
  userId: string;
  role: string;
  jobTitle: string;
  active: boolean;
}

/**
 * Change a user's role, job title or active flag. The database function admin_update_user
 * re-checks everything (admin caller, no self role change or self deactivation, last admin)
 * and writes the audit log; this only gives early, readable errors.
 */
export async function updateUser(update: UserUpdate): Promise<{ ok: true } | { ok: false; error: string }> {
  const { viewer } = await getSession();
  if (viewer.kind !== "staff" || !isAdmin(viewer.profile)) return { ok: false, error: "Only admins can change users." };
  if (!UUID_RE.test(update.userId)) return { ok: false, error: "Unknown user." };
  if (!isMemberRole(update.role)) return { ok: false, error: "Role must be admin, executor or engineer." };
  const title = update.jobTitle.trim();
  if (title.length > MAX_JOB_TITLE) return { ok: false, error: `Job title must be ${MAX_JOB_TITLE} characters or fewer.` };
  if (typeof update.active !== "boolean") return { ok: false, error: "Invalid active flag." };

  const db = await getDb();
  if (!db) return { ok: false, error: "The preview uses fake data and cannot change users." };
  const { error } = await db.rpc("admin_update_user", {
    p_user_id: update.userId,
    p_role: update.role,
    p_job_title: title || null,
    p_active: update.active,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
