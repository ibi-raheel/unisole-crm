// =====================================================================
// UniSole CRM — guided simulation
// =====================================================================
// Run this to WATCH the CRM's business rules fire against your real
// Supabase database. It creates a demo sales agent, dispatcher, and
// carrier, then walks that carrier through its whole life — narrating
// what the DATABASE does automatically at each step.
//
//   node simulation.mjs          run the walkthrough (safe to re-run)
//   node simulation.mjs --clean  just delete the demo rows and exit
//
// Everything it creates is tagged "[SIM]" so it's easy to spot in the
// app and easy to clean up. It talks to the DB with the service_role
// key, which BYPASSES row-level security — that's why it can set data
// up freely. The access wall (who-sees-what) is demonstrated by
// explanation here; you can feel it for real by logging into the app as
// an agent vs. a dispatcher vs. an admin.
// =====================================================================

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- tiny .env.local reader (no dependency needed) --------------------
function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing Supabase URL or service_role key in .env.local");
  process.exit(1);
}

// service_role client — bypasses RLS. NEVER ship this key to a browser.
const db = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- pretty printing --------------------------------------------------
const line = "─".repeat(70);
const h = (t) => console.log(`\n${line}\n  ${t}\n${line}`);
const say = (t) => console.log(`   ${t}`);
const ok = (t) => console.log(`   ✅ ${t}`);
const no = (t) => console.log(`   🛑 ${t}`);
const rule = (t) => console.log(`   📏 RULE — ${t}`);
const pause = () => new Promise((r) => setTimeout(r, 400));

// Fail loudly if a step that should succeed doesn't.
function must({ error }, what) {
  if (error) {
    console.error(`\n   ✖ Unexpected failure during "${what}":\n     ${error.message}\n`);
    process.exit(1);
  }
}

// =====================================================================
// Cleanup — remove any rows from a previous run (children → parents)
// =====================================================================
async function clean() {
  const { data: sims } = await db.from("carriers").select("id").like("company_name", "[SIM]%");
  const ids = (sims ?? []).map((r) => r.id);
  if (ids.length) {
    await db.from("loads").delete().in("carrier_id", ids);
    await db.from("carrier_status_history").delete().in("carrier_id", ids);
    await db.from("carrier_dispatcher_history").delete().in("carrier_id", ids);
    await db.from("follow_ups").delete().in("carrier_id", ids);
    await db.from("carrier_dispatch_notes").delete().in("carrier_id", ids);
    await db.from("carriers").delete().in("id", ids);
  }
  await db.from("sales_agents").delete().like("real_name", "[SIM]%");
  await db.from("dispatchers").delete().like("real_name", "[SIM]%");
}

// helper: show the status-history audit trail for a carrier
async function showHistory(carrierId) {
  const { data } = await db
    .from("carrier_status_history")
    .select("old_status,new_status,changed_at")
    .eq("carrier_id", carrierId)
    .order("changed_at", { ascending: true });
  say("Audit trail (written automatically by the database):");
  for (const r of data ?? []) {
    say(`     ${(r.old_status ?? "∅ (new sale)").padEnd(30)} →  ${r.new_status}`);
  }
}

// =====================================================================
// The walkthrough
// =====================================================================
async function run() {
  h("UniSole CRM simulation — cleaning up any previous run");
  await clean();
  ok("clean slate");

  // ----------------------------------------------------------------
  // Cast: one sales agent, one dispatcher (these are 'reference' rows)
  // ----------------------------------------------------------------
  h("STEP 1 — Set up the cast (a sales agent and a dispatcher)");
  const agentRes = await db
    .from("sales_agents")
    .insert({ real_name: "[SIM] Alice Agent", alias: "Falcon", monthly_target: 10 })
    .select()
    .single();
  must(agentRes, "create agent");
  const agent = agentRes.data;
  ok(`Sales agent #${agent.id} "${agent.real_name}" (target: ${agent.monthly_target} carriers/mo)`);

  const dispRes = await db
    .from("dispatchers")
    .insert({ real_name: "[SIM] Bob Dispatcher", alias: "Rhino", monthly_target: 5000 })
    .select()
    .single();
  must(dispRes, "create dispatcher");
  const disp = dispRes.data;
  ok(`Dispatcher #${disp.id} "${disp.real_name}" (target: $${disp.monthly_target}/mo)`);
  await pause();

  // ----------------------------------------------------------------
  // A new sale enters as a Lead
  // ----------------------------------------------------------------
  h("STEP 2 — A new sale comes in as a LEAD");
  say("Alice signs up a new trucking company. One sale = one carrier row.");
  const carrierRes = await db
    .from("carriers")
    .insert({
      company_name: "[SIM] Roadrunner Freight LLC",
      contact_person: "Sam Trucker",
      phone: "+1-555-0100",
      mc_number: "MC-998877",
      sales_agent_id: agent.id,
      status: "Lead",
      lead_source: "Cold call",
    })
    .select()
    .single();
  must(carrierRes, "create carrier");
  const carrier = carrierRes.data;
  const cid = carrier.id;
  ok(`Carrier #${cid} "${carrier.company_name}" created at status = "${carrier.status}"`);
  rule("#4 Every status change is logged. Creating the sale logged its opening status:");
  await showHistory(cid);
  await pause();

  // ----------------------------------------------------------------
  // Walk the legal sales lifecycle
  // ----------------------------------------------------------------
  h("STEP 3 — Move the sale forward through the legal pipeline");
  say("Lead → Documents Sent → Documents Received. Each move is allowed");
  say("and each one is auto-stamped and auto-logged.");

  let r = await db.from("carriers").update({ status: "Documents Sent", docs_sent_at: "2026-07-02" }).eq("id", cid);
  must(r, "→ Documents Sent");
  ok('status → "Documents Sent"');

  r = await db.from("carriers").update({ status: "Documents Received", docs_received_at: "2026-07-05" }).eq("id", cid);
  must(r, "→ Documents Received");
  ok('status → "Documents Received"  (docs_received_at drives Alice\'s monthly credit)');
  await pause();

  // ----------------------------------------------------------------
  // The automatic handoff
  // ----------------------------------------------------------------
  h("STEP 4 — Admin assigns a dispatcher → automatic handoff");
  rule('#7 Only an admin can assign the dispatcher (we are privileged here).');
  say("The instant a Documents-Received carrier gets a dispatcher, the DB");
  say('auto-advances it to "Signed — Awaiting First Load". We only SET the');
  say("dispatcher — watch the status change by itself:");
  r = await db.from("carriers").update({ dispatcher_id: disp.id }).eq("id", cid).select("status,date_assigned").single();
  must(r, "assign dispatcher");
  ok(`We set dispatcher_id = ${disp.id}`);
  ok(`Database auto-moved status → "${r.data.status}"  (date_assigned = ${r.data.date_assigned})`);
  await pause();

  // ----------------------------------------------------------------
  // Prove Active can't be faked
  // ----------------------------------------------------------------
  h("STEP 5 — Try to mark the carrier ACTIVE by hand (should be refused)");
  rule("#1 Active is automatic. NO ONE — not even an admin — can type it.");
  const badActive = await db.from("carriers").update({ status: "Active" }).eq("id", cid);
  if (badActive.error) no(`Database refused it:\n        "${badActive.error.message}"`);
  else no("UNEXPECTED: the DB allowed a manual Active (should not happen)");
  await pause();

  // ----------------------------------------------------------------
  // Prove sales agent is immutable
  // ----------------------------------------------------------------
  h("STEP 6 — Try to reassign the sale to a different agent (should be refused)");
  rule("#2 A carrier permanently belongs to the agent who signed it.");
  const otherAgent = await db
    .from("sales_agents")
    .insert({ real_name: "[SIM] Carol Agent", alias: "Viper", monthly_target: 10 })
    .select()
    .single();
  const badAgent = await db.from("carriers").update({ sales_agent_id: otherAgent.data.id }).eq("id", cid);
  if (badAgent.error) no(`Database refused it:\n        "${badAgent.error.message}"`);
  else no("UNEXPECTED: the DB allowed the agent to change");
  await pause();

  // ----------------------------------------------------------------
  // Deliver a load — the ONLY path to Active
  // ----------------------------------------------------------------
  h("STEP 7 — Dispatcher books a load, then DELIVERS it");
  say("A load pays a rate; the company keeps a % service charge.");
  say("amount_earned is COMPUTED by the DB — you can't type it.");
  const loadRes = await db
    .from("loads")
    .insert({
      carrier_id: cid,
      dispatcher_id: disp.id,
      pickup_date: "2026-07-10",
      pickup_location: "Dallas, TX",
      delivery_location: "Atlanta, GA",
      rate: 2400.0,
      service_charge_pct: 0.04, // 4%
      load_status: "En Route",
    })
    .select("id,rate,service_charge_pct,amount_earned,load_status")
    .single();
  must(loadRes, "book load");
  const load = loadRes.data;
  ok(`Load #${load.id} booked: rate $${load.rate} × ${load.service_charge_pct * 100}% service charge`);
  ok(`Database computed amount_earned = $${load.amount_earned}  (we never set this)`);
  say("");
  say('Now the dispatcher marks the load "Delivered"...');
  r = await db.from("loads").update({ load_status: "Delivered", delivery_date: "2026-07-12" }).eq("id", load.id);
  must(r, "deliver load");

  const after = await db
    .from("carriers")
    .select("status,first_load_delivered_at")
    .eq("id", cid)
    .single();
  rule("#1 Delivering a load is the ONE thing that makes a carrier Active.");
  ok(`Carrier auto-flipped to status = "${after.data.status}"`);
  ok(`first_load_delivered_at = ${after.data.first_load_delivered_at}  (set by the DB, marks the sales→dispatch handoff)`);
  await pause();

  // ----------------------------------------------------------------
  // Full audit trail
  // ----------------------------------------------------------------
  h("STEP 8 — The complete, tamper-proof audit trail");
  say("Every move above was logged automatically. No app code wrote these:");
  await showHistory(cid);
  await pause();

  // ----------------------------------------------------------------
  // What the dashboards read
  // ----------------------------------------------------------------
  h("STEP 9 — What the dashboards show (reporting views & functions)");

  const pipeline = await db.from("carrier_pipeline_counts").select("*");
  say("Pipeline counts (carriers at each status, across the whole DB):");
  for (const p of pipeline.data ?? []) say(`     ${String(p.carriers).padStart(3)}  ${p.status}`);

  const earned = await db.rpc("dispatcher_month_earned", { p_dispatcher_id: disp.id, p_month: "2026-07-01" });
  say("");
  say(`Bob's July earnings (dispatcher_month_earned) = $${earned.data}  toward his $${disp.monthly_target} target`);

  const signed = await db.rpc("sales_agent_month_signed", { p_agent_id: agent.id, p_month: "2026-07-01" });
  say(`Alice's July signings (sales_agent_month_signed) = ${signed.data}  toward her ${agent.monthly_target} target`);
  say("   (Alice keeps credit even though the carrier is now Active and has");
  say("    left her day-to-day view — Rule 6.)");

  // ----------------------------------------------------------------
  // The access wall (explained — RLS is bypassed by service_role)
  // ----------------------------------------------------------------
  h("STEP 10 — The access wall (row-level security)");
  say("This script used the service_role key, which bypasses RLS. In the");
  say("real app each person logs in and the DB shows only their slice:");
  say("");
  say("   • Alice (sales agent) — sees her carriers ONLY until they go Active,");
  say("     then they leave her view (but she keeps the monthly credit).");
  say("   • Bob (dispatcher)   — sees carriers assigned to him + their loads.");
  say("   • Admin              — sees everything; the only role that can");
  say("                          reassign a dispatcher.");
  say("");
  say("Log into http://localhost:3000 as different users to feel this live.");

  h("Done. The [SIM] rows are left in your database so you can browse them");
  say("in the app. Re-run `node simulation.mjs` to reset, or");
  say("`node simulation.mjs --clean` to remove them.");
  console.log("");
}

// --- entrypoint -------------------------------------------------------
if (process.argv.includes("--clean")) {
  await clean();
  console.log("🧹 Removed all [SIM] demo rows.");
} else {
  await run();
}
