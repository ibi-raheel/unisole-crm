"use server";

// Manager actions on the Agents page. Admin-only, checked server-side.
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { supabaseStore } from "@/lib/agents/supabaseStore";
import { makeProviders } from "@/lib/agents/providers";
import { approveDispatcher, daily, retryRun, signatureReceived, tick } from "@/lib/agents/engine";

async function admin() {
  const p = await getProfile();
  if (!p || p.role !== "admin") throw new Error("Admins only.");
  return p;
}
const num = (fd: FormData, k: string) => Number(fd.get(k));

export async function confirmDispatcher(fd: FormData) {
  const p = await admin();
  const store = supabaseStore();
  await approveDispatcher(store, num(fd, "run_id"), num(fd, "dispatcher_id"), p.email ?? "A manager");
  await tick(store, makeProviders());
  revalidatePath("/agents");
}

// Practice mode only: pretend the carrier signed in DocuSign.
export async function simulateSignature(fd: FormData) {
  await admin();
  const store = supabaseStore();
  const run = await store.getRun(num(fd, "run_id"));
  const ref = run?.context.envelope_ref;
  if (typeof ref === "string" && ref.startsWith("practice-")) {
    await signatureReceived(store, ref);
    await tick(store, makeProviders());
  }
  revalidatePath("/agents");
}

export async function retryAgentRun(fd: FormData) {
  await admin();
  const store = supabaseStore();
  await retryRun(store, num(fd, "run_id"));
  await tick(store, makeProviders());
  revalidatePath("/agents");
}

export async function runAgentsNow(fd: FormData) {
  await admin();
  const store = supabaseStore();
  if (fd.get("daily") === "1") await daily(store);
  await tick(store, makeProviders());
  revalidatePath("/agents");
}
