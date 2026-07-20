"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { FormState, fnum } from "./_util";

export type ChangeKind =
  | "create_carrier"
  | "create_load"
  | "set_load_status"
  | "set_carrier_status";

// File a pending change request for the current user. Used by the write
// actions when the caller is not an admin. Returns a FormState with a
// friendly message the form can show.
export async function fileChangeRequest(opts: {
  kind: ChangeKind;
  payload: Record<string, unknown>;
  targetId?: number | null;
  summary: string;
}): Promise<FormState> {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in." };

  const { error } = await supabase.from("change_requests").insert({
    requested_by: profile.id,
    kind: opts.kind,
    payload: opts.payload,
    target_id: opts.targetId ?? null,
    summary: opts.summary,
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/approvals");
  return { ok: true, message: "Sent to an admin for approval." };
}

// Apply an approved request's change. Runs as the admin, so it passes the
// normal RLS and fires the same DB triggers (auto-Active, logging, etc.).
async function applyChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: string,
  payload: Record<string, unknown>,
  targetId: number | null
): Promise<string | null> {
  if (kind === "create_carrier") {
    const { error } = await supabase.from("carriers").insert(payload);
    return error?.message ?? null;
  }
  if (kind === "create_load") {
    const { error } = await supabase.from("loads").insert(payload);
    return error?.message ?? null;
  }
  if (kind === "set_load_status") {
    if (!targetId) return "Missing load id.";
    const { error } = await supabase.from("loads").update(payload).eq("id", targetId);
    return error?.message ?? null;
  }
  if (kind === "set_carrier_status") {
    if (!targetId) return "Missing carrier id.";
    const { error } = await supabase.from("carriers").update(payload).eq("id", targetId);
    return error?.message ?? null;
  }
  return `Unknown request kind: ${kind}`;
}

export async function approveRequest(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const me = await getProfile();
  if (!me || me.role !== "admin") return { error: "Only an admin can approve." };
  const id = fnum(fd, "request_id");
  if (!id) return { error: "Missing request." };

  const supabase = await createClient();
  const { data: req, error: loadErr } = await supabase
    .from("change_requests")
    .select("id, kind, payload, target_id, status")
    .eq("id", id)
    .single();
  if (loadErr || !req) return { error: "Request not found." };
  if (req.status !== "pending") return { error: "This request was already reviewed." };

  // Apply the actual change first; only mark approved if it succeeded.
  const applyErr = await applyChange(
    supabase,
    req.kind as string,
    (req.payload ?? {}) as Record<string, unknown>,
    (req.target_id as number | null) ?? null
  );
  if (applyErr) return { error: `Couldn't apply: ${applyErr}` };

  const { error: markErr } = await supabase
    .from("change_requests")
    .update({ status: "approved", reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (markErr) return { error: markErr.message };

  revalidatePath("/approvals");
  revalidatePath("/carriers");
  revalidatePath("/loads");
  return { ok: true };
}

export async function rejectRequest(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const me = await getProfile();
  if (!me || me.role !== "admin") return { error: "Only an admin can reject." };
  const id = fnum(fd, "request_id");
  if (!id) return { error: "Missing request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("change_requests")
    .update({ status: "rejected", reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/approvals");
  return { ok: true };
}
