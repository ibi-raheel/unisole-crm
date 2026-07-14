"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { FormState, fstr } from "./_util";

// Log a sales-side follow-up. Attributed to the carrier's owning agent.
export async function logFollowUp(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const supabase = await createClient();
  const profile = await getProfile();
  const carrierId = Number(fd.get("carrier_id"));
  if (!carrierId) return { error: "Missing carrier." };

  const { data: carrier } = await supabase
    .from("carriers")
    .select("sales_agent_id")
    .eq("id", carrierId)
    .single();

  const agentId =
    profile?.role === "sales_agent"
      ? profile.linked_agent_id
      : carrier?.sales_agent_id;
  if (!agentId) return { error: "This carrier has no sales agent." };

  const { error } = await supabase.from("follow_ups").insert({
    carrier_id: carrierId,
    sales_agent_id: agentId,
    type: fstr(fd, "type") ?? "Call",
    notes: fstr(fd, "notes"),
    outcome: fstr(fd, "outcome"),
    next_followup_date: fstr(fd, "next_followup_date"),
  });

  if (error) return { error: error.message };
  revalidatePath(`/carriers/${carrierId}`);
  return { ok: true };
}

// Log a dispatch-side note (what was tried to get the first load moving).
export async function logDispatchNote(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const supabase = await createClient();
  const profile = await getProfile();
  const carrierId = Number(fd.get("carrier_id"));
  if (!carrierId) return { error: "Missing carrier." };

  const { data: carrier } = await supabase
    .from("carriers")
    .select("dispatcher_id")
    .eq("id", carrierId)
    .single();

  const dispId =
    profile?.role === "dispatcher"
      ? profile.linked_dispatcher_id
      : carrier?.dispatcher_id;
  if (!dispId)
    return { error: "This carrier has no dispatcher assigned yet." };

  const { error } = await supabase.from("carrier_dispatch_notes").insert({
    carrier_id: carrierId,
    dispatcher_id: dispId,
    note: fstr(fd, "note"),
    outcome: fstr(fd, "outcome"),
    next_action_date: fstr(fd, "next_action_date"),
  });

  if (error) return { error: error.message };
  revalidatePath(`/carriers/${carrierId}`);
  return { ok: true };
}
