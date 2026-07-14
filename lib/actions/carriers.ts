"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FormState, fstr, fnum, today } from "./_util";

export async function createCarrier(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in." };

  const company = fstr(fd, "company_name");
  if (!company) return { error: "Company name is required." };

  // A sales agent can only create their own carriers; an admin picks one.
  const agentId =
    profile.role === "sales_agent"
      ? profile.linked_agent_id
      : fnum(fd, "sales_agent_id");
  if (!agentId) return { error: "Please choose a sales agent." };

  const { data, error } = await supabase
    .from("carriers")
    .insert({
      company_name: company,
      contact_person: fstr(fd, "contact_person"),
      phone: fstr(fd, "phone"),
      email: fstr(fd, "email"),
      mc_number: fstr(fd, "mc_number"),
      mc_age: fstr(fd, "mc_age"),
      truck_type_id: fnum(fd, "truck_type_id"),
      sales_agent_id: agentId,
      lead_source: fstr(fd, "lead_source"),
      remarks: fstr(fd, "remarks"),
      docs_sent_at: fstr(fd, "docs_sent_at"),
      docs_received_at: fstr(fd, "docs_received_at"),
      status: fstr(fd, "status") ?? "Lead",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/carriers");
  redirect(`/carriers/${data!.id}`);
}

export async function updateCarrierDetails(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const id = fnum(fd, "carrier_id");
  if (!id) return { error: "Missing carrier." };
  const supabase = await createClient();

  const { error } = await supabase
    .from("carriers")
    .update({
      contact_person: fstr(fd, "contact_person"),
      phone: fstr(fd, "phone"),
      email: fstr(fd, "email"),
      mc_number: fstr(fd, "mc_number"),
      mc_age: fstr(fd, "mc_age"),
      truck_type_id: fnum(fd, "truck_type_id"),
      lead_source: fstr(fd, "lead_source"),
      remarks: fstr(fd, "remarks"),
      docs_sent_at: fstr(fd, "docs_sent_at"),
      docs_received_at: fstr(fd, "docs_received_at"),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/carriers/${id}`);
  redirect(`/carriers/${id}`);
}

// Status change — this is where the database rules show themselves. Setting
// "Active" with no delivered load, or an illegal jump, comes back as an error
// straight from the database.
export async function setCarrierStatus(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const id = fnum(fd, "carrier_id");
  const status = fstr(fd, "status");
  if (!id || !status) return { error: "Missing carrier or status." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("carriers")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/carriers/${id}`);
  return { ok: true };
}

// One-click milestones: move the status AND stamp the matching date together,
// so the sales target (which counts by docs-received date) updates on its own.
export async function markMilestone(formData: FormData): Promise<void> {
  const id = fnum(formData, "carrier_id");
  const milestone = fstr(formData, "milestone");
  if (!id || !milestone) return;

  const patch: Record<string, string> = {};
  if (milestone === "docs_sent") {
    patch.status = "Documents Sent";
    patch.docs_sent_at = today();
  } else if (milestone === "docs_received") {
    patch.status = "Documents Received";
    patch.docs_received_at = today();
  } else if (milestone === "dead") {
    patch.status = "Dead";
  } else if (milestone === "no_agreement") {
    patch.status = "No Agreement";
  } else {
    return;
  }

  const supabase = await createClient();
  await supabase.from("carriers").update(patch).eq("id", id);
  revalidatePath(`/carriers/${id}`);
}

// Admin only — assign or change the dispatcher. The database enforces both the
// admin-only rule and the audit log.
export async function assignDispatcher(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const id = fnum(fd, "carrier_id");
  const dispatcherId = fnum(fd, "dispatcher_id");
  if (!id) return { error: "Missing carrier." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("carriers")
    .update({
      dispatcher_id: dispatcherId,
      date_assigned: dispatcherId ? today() : null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/carriers/${id}`);
  return { ok: true };
}
