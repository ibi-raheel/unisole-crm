"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FormState, fstr, fnum } from "./_util";

export async function createLoad(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in." };

  const carrierId = fnum(fd, "carrier_id");
  if (!carrierId) return { error: "Please choose a carrier." };

  // A dispatcher books under their own id; an admin picks the dispatcher.
  const dispId =
    profile.role === "dispatcher"
      ? profile.linked_dispatcher_id
      : fnum(fd, "dispatcher_id");
  if (!dispId) return { error: "Please choose a dispatcher." };

  const rate = fnum(fd, "rate");
  const pct = fnum(fd, "service_charge_pct");
  if (rate == null) return { error: "Rate is required." };
  if (pct == null) return { error: "Service charge % is required." };

  const payload = {
    carrier_id: carrierId,
    dispatcher_id: dispId,
    pickup_date: fstr(fd, "pickup_date"),
    pickup_location: fstr(fd, "pickup_location"),
    delivery_date: fstr(fd, "delivery_date"),
    delivery_location: fstr(fd, "delivery_location"),
    rate,
    service_charge_pct: pct,
    broker_name: fstr(fd, "broker_name"),
    broker_mc: fstr(fd, "broker_mc"),
    broker_contact: fstr(fd, "broker_contact"),
    payment_status: fstr(fd, "payment_status") ?? "Pending",
    payment_route: fstr(fd, "payment_route"),
    load_status: fstr(fd, "load_status") ?? "En Route",
    remarks: fstr(fd, "remarks"),
  };

  const supabase = await createClient();
  const { error } = await supabase.from("loads").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/loads");
  revalidatePath(`/carriers/${carrierId}`);
  redirect(`/carriers/${carrierId}`);
}

// Update a load's delivery/payment status. Marking a load "Delivered" is what
// automatically flips its carrier to Active (handled by the database).
export async function setLoadStatus(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const id = fnum(fd, "load_id");
  const carrierId = fnum(fd, "carrier_id");
  if (!id) return { error: "Missing load." };

  const patch: Record<string, string> = {};
  const ls = fstr(fd, "load_status");
  const ps = fstr(fd, "payment_status");
  if (ls) patch.load_status = ls;
  if (ps) patch.payment_status = ps;

  const supabase = await createClient();
  const { error } = await supabase.from("loads").update(patch).eq("id", id);

  if (error) return { error: error.message };
  if (carrierId) revalidatePath(`/carriers/${carrierId}`);
  revalidatePath("/loads");
  return { ok: true };
}

// Admin-only: change a load's amount (rate), with a required reason. The old
// and new rate + reason are recorded in load_amount_changes. amount_earned
// recalculates automatically from the new rate.
export async function editLoadAmount(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const me = await getProfile();
  if (!me || me.role !== "admin") {
    return { error: "Only an admin can edit a load's amount." };
  }
  const id = fnum(fd, "load_id");
  const newRate = fnum(fd, "rate");
  const reason = fstr(fd, "reason");
  if (!id) return { error: "Missing load." };
  if (newRate == null || newRate < 0) return { error: "Enter a valid new amount." };
  if (!reason) return { error: "A reason for the change is required." };

  const supabase = await createClient();
  const { data: load } = await supabase
    .from("loads")
    .select("rate, carrier_id")
    .eq("id", id)
    .single();
  const oldRate = load?.rate ?? null;

  const { error } = await supabase.from("loads").update({ rate: newRate }).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("load_amount_changes").insert({
    load_id: id,
    old_rate: oldRate,
    new_rate: newRate,
    reason,
    changed_by: me.id,
  });

  if (load?.carrier_id) revalidatePath(`/carriers/${load.carrier_id}`);
  revalidatePath("/loads");
  return { ok: true };
}
