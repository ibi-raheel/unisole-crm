"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { FormState, fstr, fnum } from "./_util";

export async function createSalesAgent(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const name = fstr(fd, "real_name");
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("sales_agents").insert({
    real_name: name,
    alias: fstr(fd, "alias"),
    monthly_target: fnum(fd, "monthly_target") ?? 0,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/team");
  return { ok: true };
}

// Create an actual login (email + password) for a team member and link it to
// their agent/dispatcher record. Admin-only. Uses the service-role key.
export async function createUserLogin(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  // Only an admin may create logins.
  const me = await getProfile();
  if (!me || me.role !== "admin") {
    return { error: "Only an admin can create logins." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "The server is missing its service-role key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart, then try again.",
    };
  }

  const email = fstr(fd, "email");
  const password = fstr(fd, "password");
  const role = fstr(fd, "role");
  const agentId = fnum(fd, "linked_agent_id");
  const dispId = fnum(fd, "linked_dispatcher_id");

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (role !== "sales_agent" && role !== "dispatcher" && role !== "admin")
    return { error: "Pick a role." };
  if (role === "sales_agent" && !agentId)
    return { error: "Choose which sales agent this login is for." };
  if (role === "dispatcher" && !dispId)
    return { error: "Choose which dispatcher this login is for." };

  const admin = createAdminClient();

  // 1) Create the Auth user (email pre-confirmed so they can log in at once).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return { error: createErr.message };
  const userId = created.user?.id;
  if (!userId) return { error: "Could not create the login." };

  // 2) Link it to the business profile.
  const { error: profErr } = await admin.from("profiles").insert({
    id: userId,
    email,
    role,
    linked_agent_id: role === "sales_agent" ? agentId : null,
    linked_dispatcher_id: role === "dispatcher" ? dispId : null,
  });
  if (profErr) {
    // Don't leave an orphaned Auth user if the profile insert fails.
    await admin.auth.admin.deleteUser(userId);
    return { error: profErr.message };
  }

  revalidatePath("/admin/team");
  return { ok: true };
}

export async function createDispatcher(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const name = fstr(fd, "real_name");
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("dispatchers").insert({
    real_name: name,
    alias: fstr(fd, "alias"),
    monthly_target: fnum(fd, "monthly_target") ?? 0,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/team");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Edit / deactivate team members. Admin-only (RLS also enforces this).
// Deactivating never deletes: it flips is_active, so historical carriers,
// loads, targets, and the audit trail are all preserved.
// ---------------------------------------------------------------------

async function adminGuard(): Promise<string | null> {
  const me = await getProfile();
  if (!me || me.role !== "admin") return "Only an admin can manage the team.";
  return null;
}

// Pages that surface team data (leaderboards, targets, presence) so a change
// shows up immediately everywhere.
function revalidateTeamViews() {
  revalidatePath("/admin/team");
  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function updateSalesAgent(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const guard = await adminGuard();
  if (guard) return { error: guard };
  const id = fnum(fd, "id");
  const name = fstr(fd, "real_name");
  if (!id) return { error: "Missing agent id." };
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_agents")
    .update({
      real_name: name,
      alias: fstr(fd, "alias"),
      monthly_target: fnum(fd, "monthly_target") ?? 0,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTeamViews();
  return { ok: true };
}

export async function updateDispatcher(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const guard = await adminGuard();
  if (guard) return { error: guard };
  const id = fnum(fd, "id");
  const name = fstr(fd, "real_name");
  if (!id) return { error: "Missing dispatcher id." };
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dispatchers")
    .update({
      real_name: name,
      alias: fstr(fd, "alias"),
      monthly_target: fnum(fd, "monthly_target") ?? 0,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTeamViews();
  return { ok: true };
}

export async function setSalesAgentActive(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const guard = await adminGuard();
  if (guard) return { error: guard };
  const id = fnum(fd, "id");
  if (!id) return { error: "Missing agent id." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_agents")
    .update({ is_active: fstr(fd, "active") === "true" })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTeamViews();
  return { ok: true };
}

export async function setDispatcherActive(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const guard = await adminGuard();
  if (guard) return { error: guard };
  const id = fnum(fd, "id");
  if (!id) return { error: "Missing dispatcher id." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dispatchers")
    .update({ is_active: fstr(fd, "active") === "true" })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTeamViews();
  return { ok: true };
}
