// =====================================================================
// Supabase Store — the agents working against the real CRM database.
// =====================================================================
// Uses the service-role key, server-side only, so the agents act as a
// trusted system process: auth.uid() is null, app_is_privileged() is true,
// and every status/dispatcher change is still written to the history
// tables by the existing triggers. The lifecycle rules (Active is computed,
// sales_agent_id is immutable) are enforced by the database for the agents
// exactly as they are for people.
// =====================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Carrier, Run, Store } from "./types.ts";

const CARRIER_COLS = "id, company_name, contact_person, phone, email, mc_number, status, sales_agent_id, dispatcher_id, created_at, docs_sent_at, truck_types(code), sales_agents(real_name)";
const OPEN = ["Lead", "Documents Sent", "Documents Received", "Signed — Awaiting First Load", "Active"];

function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export function supabaseStore(db?: SupabaseClient): Store {
  const sb = db ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  async function lastFollowUps(ids: number[]): Promise<Map<number, string>> {
    const m = new Map<number, string>();
    if (!ids.length) return m;
    const rows = must(await sb.from("carrier_latest_followup").select("carrier_id, contacted_at").in("carrier_id", ids)) as { carrier_id: number; contacted_at: string }[];
    for (const r of rows) m.set(r.carrier_id, r.contacted_at);
    return m;
  }
  const toCarrier = (r: any, last?: string): Carrier => ({
    id: r.id, company_name: r.company_name, contact_person: r.contact_person, phone: r.phone, email: r.email, mc_number: r.mc_number,
    truck_type: r.truck_types?.code ?? null, status: r.status, sales_agent_id: r.sales_agent_id, sales_agent: r.sales_agents?.real_name ?? null,
    dispatcher_id: r.dispatcher_id, created_at: r.created_at, docs_sent_at: r.docs_sent_at, last_follow_up_at: last ?? null,
  });

  return {
    async dueRuns(now, limit) {
      return must(await sb.from("agent_runs").select("*").in("status", ["queued", "waiting"]).lte("next_run_at", now.toISOString()).order("next_run_at").limit(limit)) as Run[];
    },
    async getRun(id) { return must(await sb.from("agent_runs").select("*").eq("id", id).maybeSingle()) as Run | null; },
    async createRun(r) { return must(await sb.from("agent_runs").insert({ ...r, context: r.context ?? {} }).select("*").single()) as Run; },
    async updateRun(id, patch) { must(await sb.from("agent_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)); },
    async recentRun(agent, carrierId, sinceDays) {
      const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
      const r = await sb.from("agent_runs").select("id", { count: "exact", head: true }).eq("agent", agent).eq("carrier_id", carrierId).gte("created_at", since);
      if (r.error) throw new Error(r.error.message);
      return (r.count ?? 0) > 0;
    },
    async findWaitingByRef(ref) {
      return must(await sb.from("agent_runs").select("*").eq("status", "waiting").eq("context->>envelope_ref", ref).maybeSingle()) as Run | null;
    },
    async logStep(s) { must(await sb.from("agent_steps").insert(s)); },
    async saveDoc(d) { must(await sb.from("agent_documents").insert(d)); },
    async recordOutbound(o) { must(await sb.from("agent_outbox").insert(o)); },

    async carrier(id) {
      const r = must(await sb.from("carriers").select(CARRIER_COLS).eq("id", id).maybeSingle());
      if (!r) return null;
      return toCarrier(r, (await lastFollowUps([id])).get(id));
    },
    async setCarrierStatus(id, status) { must(await sb.from("carriers").update({ status }).eq("id", id)); },
    async assignDispatcher(carrierId, dispatcherId) {
      must(await sb.from("carriers").update({ dispatcher_id: dispatcherId, date_assigned: new Date().toISOString().slice(0, 10) }).eq("id", carrierId));
    },
    async dispatchers() {
      const ds = must(await sb.from("dispatchers").select("id, real_name").eq("is_active", true)) as { id: number; real_name: string }[];
      const owned = must(await sb.from("carriers").select("dispatcher_id").not("dispatcher_id", "is", null).in("status", OPEN)) as { dispatcher_id: number }[];
      const emails = must(await sb.from("profiles").select("linked_dispatcher_id, email").not("linked_dispatcher_id", "is", null).eq("is_active", true)) as { linked_dispatcher_id: number; email: string | null }[];
      return ds.map(d => ({ id: d.id, name: d.real_name, email: emails.find(e => e.linked_dispatcher_id === d.id)?.email ?? null,
        open_carriers: owned.filter(o => o.dispatcher_id === d.id).length }));
    },
    async quietCarriers(days) {
      const rows = must(await sb.from("carriers").select(CARRIER_COLS).in("status", ["Lead", "Documents Sent"]).limit(1000)) as any[];
      const last = await lastFollowUps(rows.map(r => r.id));
      const cut = Date.now() - days * 864e5;
      return rows.map(r => toCarrier(r, last.get(r.id))).filter(k => new Date(k.last_follow_up_at ?? k.created_at).getTime() < cut);
    },
    async load(id) {
      const r: any = must(await sb.from("loads").select("*, carriers(company_name, email), dispatchers(real_name)").eq("id", id).maybeSingle());
      if (!r) return null;
      return { id: r.id, carrier_id: r.carrier_id, carrier: r.carriers?.company_name ?? "—", carrier_email: r.carriers?.email ?? null, dispatcher: r.dispatchers?.real_name ?? null,
        pickup_date: r.pickup_date, pickup_location: r.pickup_location, delivery_date: r.delivery_date, delivery_location: r.delivery_location,
        rate: Number(r.rate), service_charge_pct: Number(r.service_charge_pct), amount_earned: Number(r.amount_earned),
        broker_name: r.broker_name ?? null, broker_mc: r.broker_mc ?? null, load_status: r.load_status };
    },
    async pipeline() {
      const rows = must(await sb.from("carrier_pipeline_counts").select("status, carriers")) as { status: string; carriers: number }[];
      return rows.map(r => ({ status: r.status, count: Number(r.carriers) }));
    },
    async stalled() {
      const rows = must(await sb.from("stalled_carriers").select("company_name, days_stalled, dispatcher_name").order("days_stalled", { ascending: false })) as any[];
      return rows.map(r => ({ company_name: r.company_name, days: Number(r.days_stalled ?? 0), dispatcher: r.dispatcher_name ?? null }));
    },
    async adminEmails() {
      const rows = must(await sb.from("profiles").select("email").eq("role", "admin").eq("is_active", true)) as { email: string | null }[];
      return rows.map(r => r.email).filter((e): e is string => !!e);
    },
  };
}
