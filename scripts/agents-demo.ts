// =====================================================================
// npm run agents:demo — watch the agents work, with no database and no keys
// =====================================================================
// Runs the real agent engine (lib/agents) against an in-memory copy of the
// CRM on a simulated clock: a carrier moves to "Documents Sent", the
// onboarding agent drafts, reviews and sends the contract, reminds, gets
// the signature, sends the package, suggests a dispatcher, a manager
// confirms, and the agent introduces them, says hello and places the call.
// Then the daily follow-ups, the paperwork for a load, and the summary.
// Writes docs/agents/demo-report.html (open it in a browser).
// =====================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { memoryStore } from "../lib/agents/memoryStore.ts";
import { makeProviders } from "../lib/agents/providers.ts";
import { approveDispatcher, daily, signatureReceived, tick } from "../lib/agents/engine.ts";
import type { Carrier } from "../lib/agents/types.ts";

let now = new Date("2026-10-13T14:00:00Z");
const clock = () => now;
const later = (min: number) => { now = new Date(now.getTime() + min * 60e3); };
const days = (n: number) => new Date(now.getTime() - n * 864e5).toISOString();

const carrier = (id: number, company: string, status: string, extra: Partial<Carrier> = {}): Carrier => ({
  id, company_name: company, contact_person: "Dana Whitfield", phone: "+1 (214) 555-0142", email: "dana@ridgewayhaul.example",
  mc_number: "MC-1184532", truck_type: "SD", status, sales_agent_id: 1, sales_agent: "Sara (Sales)", dispatcher_id: null,
  created_at: days(9), docs_sent_at: null, last_follow_up_at: days(1), ...extra,
});

const store = memoryStore({
  admins: ["ops@unisole.example"],
  dispatchers: [{ id: 1, name: "Omar Siddiqui", email: "omar@unisole.example", open_carriers: 7 }, { id: 2, name: "Hira Malik", email: "hira@unisole.example", open_carriers: 4 }],
  carriers: [
    carrier(12, "Ridgeway Haulers LLC", "Lead"),
    carrier(13, "Blue Mesa Freight", "Lead", { contact_person: "Luis Ortega", phone: "+1 (602) 555-0187", email: "luis@bluemesa.example", last_follow_up_at: days(6) }),
    carrier(14, "Hollow Creek Transport", "Lead", { contact_person: "Amy Cole", email: null, mc_number: "77", last_follow_up_at: days(2) }),
  ],
  loads: [{ id: 40, carrier_id: 12, carrier: "Ridgeway Haulers LLC", carrier_email: "dana@ridgewayhaul.example", dispatcher: "Hira Malik", pickup_date: "2026-10-20",
    pickup_location: "Dallas, TX", delivery_date: "2026-10-22", delivery_location: "Atlanta, GA", rate: 2850, service_charge_pct: 0.05, amount_earned: 142.5,
    broker_name: "Summit Logistics", broker_mc: "MC-998812", load_status: "En Route" }],
}, clock);
const P = makeProviders({}, { forcePractice: true });
const say = (s: string) => console.log(s);
const show = async (label: string) => {
  say(`\n— ${label} (${now.toISOString().slice(0, 16).replace("T", " ")})`);
  for (const r of await tick(store, P, { now, env: {} })) {
    const run = store.mem.runs.find(x => x.id === r.run_id)!;
    for (const s of store.mem.steps.filter(s => s.run_id === r.run_id).slice(-r.steps.length || -1)) say(`   [${run.agent}] ${s.step}: ${s.detail}`);
  }
};

// The database trigger does this when a salesperson marks "Documents Sent":
const start = async (id: number) => { store.mem.carriers.find(k => k.id === id)!.status = "Documents Sent"; await store.createRun({ agent: "onboarding", carrier_id: id, load_id: null, step: "draft_contract" }); };

say("UniSole agents — practice mode (nothing leaves this computer)");
await start(12); await start(14);
await show("Salesperson marks Ridgeway Haulers and Hollow Creek as Documents Sent");
later(2 * 24 * 60); await show("Two days later, no signature yet");
later(5 * 60);
const env = store.mem.runs.find(r => r.carrier_id === 12)!.context.envelope_ref as string;
await signatureReceived(store, env, now); await show("DocuSign: Ridgeway Haulers signed");
const wait = store.mem.runs.find(r => r.carrier_id === 12)!;
await approveDispatcher(store, wait.id, Number(wait.context.suggested_dispatcher_id), "ops@unisole.example", now);
await show("A manager confirms the suggested dispatcher");
later(10); await show("Ten minutes later");
later(30); await show("Thirty minutes later");
later(14 * 60); await daily(store); await show("Next morning: daily jobs");
await store.createRun({ agent: "paperwork", carrier_id: 12, load_id: 40, step: "rate_confirmation" });
await show("Hira books Ridgeway's first load");
later(2 * 24 * 60); await store.createRun({ agent: "paperwork", carrier_id: 12, load_id: 40, step: "invoice" });
await show("The load is delivered");

const k12 = store.mem.carriers.find(k => k.id === 12)!;
say(`\nRidgeway Haulers is now "${k12.status}" with dispatcher #${k12.dispatcher_id}.`);
say(`${store.mem.steps.length} steps logged, ${store.mem.docs.length} documents written, ${store.mem.outbox.length} messages drafted (practice mode: 0 sent).`);

// ---------------------------------------------------------------- the report
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const name = (id: number | null) => store.mem.carriers.find(k => k.id === id)?.company_name ?? (id ? `#${id}` : "all carriers");
const label: Record<string, string> = { onboarding: "Onboarding", follow_up: "Follow-up", paperwork: "Paperwork", summary: "Daily summary" };
const run12 = store.mem.runs.find(r => r.carrier_id === 12 && r.agent === "onboarding")!;
const html = `<!doctype html><meta charset="utf-8"><title>UniSole · Agents</title><style>
:root{--p7:#4a32a8;--p6:#5b41c2;--p2:#d3c9ef;--p50:#f7f5fd;--ink:#1d1830;--mut:#6b6580}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:#f4f2fa;display:grid;grid-template-columns:200px 1fr;min-height:100vh}
nav{background:var(--p7);color:#fff;padding:20px 14px}nav b{display:block;font-size:16px;margin-bottom:18px}nav a{display:block;color:#e6e0fb;padding:7px 10px;border-radius:6px;text-decoration:none;font-size:13.5px}nav a.on{background:rgba(255,255,255,.16);color:#fff}
main{padding:22px 28px;max-width:1200px}h1{margin:0;font-size:22px}h2{font-size:14px;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.card{background:#fff;border:1px solid #e7e3f3;border-radius:10px;padding:16px 18px;margin-top:14px}.mut{color:var(--mut)}
.mode{border-left:3px solid var(--p6);background:var(--p50)}.b{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;background:#ece9f7;color:var(--p7);margin:6px 6px 0 0}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11.5px;color:var(--mut);font-weight:600;padding:6px 8px;background:var(--p50)}td{padding:7px 8px;border-top:1px solid #f0edf8;font-size:13px;vertical-align:top}
.st{padding:2px 8px;border-radius:999px;font-size:11.5px}.done{background:#dcfce7;color:#166534}.needs_approval{background:#fef3c7;color:#92400e}.waiting,.queued{background:#eef2ff;color:#3730a3}.failed{background:#fee2e2;color:#991b1b}
.grid{display:grid;grid-template-columns:3fr 2fr;gap:14px}.grid .card{margin-top:14px}
ol.tl{list-style:none;margin:0;padding:0 0 0 18px;border-left:2px solid var(--p2)}ol.tl li{position:relative;padding:0 0 12px 12px}ol.tl li:before{content:"";position:absolute;left:-25px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--p6)}
ol.tl li.waiting:before,ol.tl li.needs_approval:before{background:#d97706}ol.tl strong{text-transform:capitalize}ol.tl p{margin:2px 0 0;font-size:12.5px}
pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,monospace;background:var(--p50);padding:12px;border-radius:6px;margin:0}
.btn{display:inline-block;border:1px solid #d9d3ee;border-radius:6px;padding:4px 10px;font-size:12px;background:#fff}.pri{background:#d6336c;color:#fff;border-color:#d6336c}
</style><nav><b>UniSole CRM</b><a>Dashboard</a><a>Carriers</a><a>Loads</a><a>Team</a><a>Admin</a><a class="on">Agents</a></nav><main>
<div style="display:flex;justify-content:space-between;align-items:end"><div><h1>Agents</h1><div class="mut">They onboard new carriers, chase quiet leads, write the paperwork and summarize the day. Every step is logged here.</div></div><div><span class="btn">Run now</span> <span class="btn">Run daily jobs</span></div></div>
<div class="card mode"><strong>Practice mode.</strong> No keys are configured, so the agents do everything except contact the outside world. The outbox shows exactly what they would have sent.<br>${Object.entries(P.mode).map(([k, m]) => `<span class="b">${k}: ${m}</span>`).join("")}</div>
<div class="card"><h2>Needs a person</h2><table><tr><th>Carrier</th><th>Agent</th><th>Where it is</th><th></th></tr>${store.mem.runs.filter(r => r.status === "needs_approval").map(r =>
  `<tr><td>${esc(name(r.carrier_id))}</td><td>${label[r.agent]}</td><td>${esc(String((r.context.review_issues as string[] | undefined)?.join(" ") ?? r.step))}</td><td style="text-align:right"><span class="btn">Retry</span></td></tr>`).join("") || `<tr><td colspan=4 class="mut">Nothing is waiting on you.</td></tr>`}</table></div>
<div class="grid"><div class="card"><h2>Ridgeway Haulers LLC · onboarding</h2><ol class="tl">${store.mem.steps.filter(s => s.run_id === run12.id).map(s =>
  `<li class="${s.status}"><strong>${s.step.replaceAll("_", " ")}</strong> <span class="mut">${s.at.slice(5, 16).replace("T", " ")}</span><p>${esc(s.detail)}</p></li>`).join("")}</ol></div>
<div><div class="card" style="margin-top:14px"><h2>Recent runs</h2><table><tr><th>Job</th><th>Step</th><th>Status</th></tr>${[...store.mem.runs].reverse().map(r =>
  `<tr><td>${label[r.agent]} · ${esc(r.load_id ? "Load #" + r.load_id : name(r.carrier_id))}</td><td>${r.step.replaceAll("_", " ")}</td><td><span class="st ${r.status}">${r.status.replace("_", " ")}</span></td></tr>`).join("")}</table></div>
<div class="card"><h2>The contract it drafted</h2><pre>${esc(store.mem.docs.find(d => d.kind === "contract" && d.carrier_id === 12)!.body)}</pre></div></div></div>
<div class="card"><h2>Outbox (practice: drafted, not sent)</h2><table><tr><th>Channel</th><th>To</th><th>Message</th></tr>${store.mem.outbox.slice(-9).reverse().map(o =>
  `<tr><td>${o.channel}</td><td>${esc(o.to_addr)}</td><td>${o.subject ? `<strong>${esc(o.subject)}.</strong> ` : ""}${esc(o.body.slice(0, 190))}${o.body.length > 190 ? "…" : ""}</td></tr>`).join("")}</table></div>
</main>`;
mkdirSync("docs/agents", { recursive: true });
writeFileSync("docs/agents/demo-report.html", html);
say("\nWrote docs/agents/demo-report.html");
