// =====================================================================
// UniSole agents — the engine
// =====================================================================
// A run is one agent working one job (onboarding one carrier, invoicing
// one load). Each run moves through named steps. tick() picks up every run
// that is due and advances it as far as it can go right now; a run stops
// when it must wait for the outside world (a signature), for a person (a
// manager confirming a dispatcher), or for a timer (the hello call).
//
// Every step writes a line to agent_steps, every document to
// agent_documents, every message to agent_outbox. Nothing an agent does is
// invisible.
//
//   ONBOARDING (starts by itself when a carrier moves to "Documents Sent";
//   a database trigger queues it, so no code path can skip it)
//     draft_contract → review_contract → send_esign → [waits for signature,
//     reminding every 2 days, 3 times] → mark_received → send_package →
//     suggest_dispatcher → [manager confirms] → introduce_dispatcher →
//     hello_message → hello_call → done
//
//   FOLLOW_UP  (daily) nudge carriers in Lead / Documents Sent who went quiet
//   PAPERWORK  (on load booked / delivered) rate confirmation, then invoice
//   SUMMARY    (daily) pipeline + "signed, no load yet" digest for admins
// =====================================================================

import type { AgentName, Carrier, Channel, Providers, Run, RunStatus, StepStatus, Store } from "./types.ts";
import * as T from "./templates.ts";

type Ctx = { store: Store; p: Providers; run: Run; now: Date; env: Record<string, string | undefined> };
type Result = { detail: string; next?: string; status?: RunStatus; stepStatus?: StepStatus; context?: Record<string, unknown>; delayMin?: number };
type Handler = (c: Ctx) => Promise<Result>;

const DAY_MIN = 24 * 60;

async function send(c: Ctx, channel: Exclude<Channel, "esign">, to: string | null | undefined, body: string, subject: string | null = null): Promise<string> {
  if (!to) return `no ${channel === "email" ? "email" : "phone"} on file, ${channel} skipped`;
  try {
    const r = channel === "email" ? await c.p.email(to, subject ?? "", body)
      : channel === "whatsapp" ? await c.p.whatsapp(to, body) : await c.p.call(to, body);
    await c.store.recordOutbound({ run_id: c.run.id, channel, to_addr: to, subject, body, status: r.status, provider_ref: r.ref });
    return r.status === "practice" ? `${channel} drafted (practice mode)` : `${channel} sent`;
  } catch (e) {
    await c.store.recordOutbound({ run_id: c.run.id, channel, to_addr: to, subject, body, status: "failed", provider_ref: null });
    throw e;
  }
}

async function carrierOf(c: Ctx): Promise<Carrier> {
  const k = c.run.carrier_id != null ? await c.store.carrier(c.run.carrier_id) : null;
  if (!k) throw new Error(`carrier ${c.run.carrier_id} not found`);
  return k;
}

// ---------------------------------------------------------------- onboarding
const onboarding: Record<string, Handler> = {
  async draft_contract(c) {
    const k = await carrierOf(c);
    const doc = T.contract(k, c.now);
    const note = await c.p.llm(
      "You write short, warm, plain-English notes for a US truck-dispatch company. Two sentences. No promises about rates or loads.",
      `Write a cover note to ${k.contact_person ?? "the owner"} of ${k.company_name} (equipment: ${k.truck_type ?? "unknown"}) saying their dispatch agreement is on its way for e-signature.`)
      ?? `Hi ${(k.contact_person || "there").split(" ")[0]}, your ${T.COMPANY} dispatch agreement is on its way for e-signature. It takes two minutes, and we can start booking loads for you as soon as it's signed.`;
    await c.store.saveDoc({ run_id: c.run.id, carrier_id: k.id, load_id: null, kind: "contract", title: doc.title, body: doc.body });
    return { detail: `Drafted "${doc.title}" from the carrier's details and the standard terms.`, next: "review_contract", context: { contract_title: doc.title, contract_body: doc.body, cover_note: note } };
  },

  async review_contract(c) {
    const k = await carrierOf(c);
    const body = String(c.run.context.contract_body ?? "");
    const issues = T.reviewContract(k, body);
    const second = await c.p.llm(
      "You review dispatch agreements before they are sent. Reply with the single word OK if nothing is wrong; otherwise list each problem on its own line. Never rewrite the contract.",
      body);
    if (second && !/^\s*ok\b/i.test(second)) issues.push(...second.split("\n").map(s => "AI review: " + s.replace(/^[-*\d.\s]+/, "")).filter(s => s.length > 12));
    if (issues.length) return { detail: `Held for a person: ${issues.join(" ")}`, status: "needs_approval", stepStatus: "needs_approval", context: { review_issues: issues } };
    return { detail: `Passed review${second ? " (rules + AI second opinion)" : " (rules)"}: company, contact email, MC number, terms.`, next: "send_esign", context: { review_issues: [] } };
  },

  async send_esign(c) {
    const k = await carrierOf(c);
    const title = String(c.run.context.contract_title);
    const r = await c.p.esign({ to: k.email!, name: k.contact_person || k.company_name, title, body: String(c.run.context.contract_body) });
    await c.store.recordOutbound({ run_id: c.run.id, channel: "esign", to_addr: k.email!, subject: title, body: "DocuSign envelope: " + title, status: r.status, provider_ref: r.ref });
    const wa = await send(c, "whatsapp", k.phone, String(c.run.context.cover_note));
    return { detail: `DocuSign ${r.status === "practice" ? "envelope prepared (practice mode)" : "envelope sent"} to ${k.email}; heads-up ${wa}. Waiting for the signature.`,
      next: "await_signature", status: "waiting", stepStatus: "waiting", context: { envelope_ref: r.ref, reminders: 0 }, delayMin: 2 * DAY_MIN };
  },

  // Runs only when the 2-day timer fires without a signature.
  async await_signature(c) {
    const k = await carrierOf(c);
    const n = Number(c.run.context.reminders ?? 0) + 1;
    if (n > 3) return { detail: "Still unsigned after 3 reminders. Handed back to the sales agent.", status: "needs_approval", stepStatus: "needs_approval" };
    const how = await send(c, "whatsapp", k.phone, T.signatureReminder(k, n));
    return { detail: `No signature yet. Reminder ${n} of 3: ${how}.`, next: "await_signature", status: "waiting", stepStatus: "waiting", context: { reminders: n }, delayMin: 2 * DAY_MIN };
  },

  async mark_received(c) {
    const k = await carrierOf(c);
    if (k.status === "Documents Sent") await c.store.setCarrierStatus(k.id, "Documents Received");
    return { detail: `Signed agreement received. Carrier moved to "Documents Received".`, next: "send_package" };
  },

  async send_package(c) {
    const k = await carrierOf(c);
    const pkg = T.onboardingPackage(k);
    await c.store.saveDoc({ run_id: c.run.id, carrier_id: k.id, load_id: null, kind: "onboarding_package", title: pkg.title, body: pkg.body });
    const a = await send(c, "email", k.email, pkg.body, pkg.title);
    const b = await send(c, "whatsapp", k.phone, `${pkg.title}. We've emailed it to ${k.email ?? "you"}. It lists the four documents we need and how booking works.`);
    return { detail: `Onboarding package: ${a}; ${b}.`, next: "suggest_dispatcher" };
  },

  async suggest_dispatcher(c) {
    const ds = (await c.store.dispatchers()).sort((a, b) => a.open_carriers - b.open_carriers);
    if (!ds.length) return { detail: "No active dispatchers to suggest. Add one, then retry.", status: "needs_approval", stepStatus: "needs_approval" };
    const d = ds[0];
    const ctx = { suggested_dispatcher_id: d.id, suggested_dispatcher: d.name };
    if (c.env.AGENT_AUTO_ASSIGN === "true")
      return { detail: `Assigned ${d.name} automatically (fewest open carriers: ${d.open_carriers}).`, next: "introduce_dispatcher", context: { ...ctx, dispatcher_id: d.id } };
    return { detail: `Suggests ${d.name} (fewest open carriers: ${d.open_carriers}). Waiting for a manager to confirm.`, next: "await_approval", status: "needs_approval", stepStatus: "needs_approval", context: ctx };
  },

  async await_approval() {
    return { detail: "Waiting for a manager to confirm the dispatcher.", status: "needs_approval", stepStatus: "needs_approval" };
  },

  async introduce_dispatcher(c) {
    const k = await carrierOf(c);
    const id = Number(c.run.context.dispatcher_id);
    const d = (await c.store.dispatchers()).find(x => x.id === id);
    if (!d) throw new Error(`dispatcher ${id} not found`);
    await c.store.assignDispatcher(k.id, d.id); // the database moves the carrier to "Signed — Awaiting First Load"
    const a = await send(c, "whatsapp", k.phone, T.dispatcherIntroToCarrier(k, d));
    const b = await send(c, "email", d.email, T.dispatcherBrief(k), `New carrier: ${k.company_name}`);
    return { detail: `Assigned ${d.name}; carrier is now "Signed — Awaiting First Load". Introduction ${a}; dispatcher brief ${b}.`, next: "hello_message", context: { dispatcher_name: d.name }, delayMin: 10 };
  },

  async hello_message(c) {
    const k = await carrierOf(c);
    const d = { id: 0, name: String(c.run.context.dispatcher_name), email: null, open_carriers: 0 };
    return { detail: `Hello message from ${d.name}: ${await send(c, "whatsapp", k.phone, T.helloMessage(k, d))}.`, next: "hello_call", delayMin: 30 };
  },

  async hello_call(c) {
    const k = await carrierOf(c);
    const d = { id: 0, name: String(c.run.context.dispatcher_name), email: null, open_carriers: 0 };
    return { detail: `Hello call: ${await send(c, "call", k.phone, T.helloCallScript(k, d))}. Onboarding complete.`, status: "done" };
  },
};

// ---------------------------------------------------------------- the others
const followUp: Record<string, Handler> = {
  async nudge(c) {
    const k = await carrierOf(c);
    const text = (await c.p.llm(
      "You write one short WhatsApp follow-up from a US truck-dispatch company to a carrier who went quiet. Friendly, no pressure, under 40 words, no promises about rates.",
      `Carrier: ${k.company_name}, contact ${k.contact_person ?? "unknown"}, status "${k.status}", last contact ${k.last_follow_up_at ?? "never"}.`)) ?? T.followUpNudge(k);
    const how = await send(c, k.phone ? "whatsapp" : "email", k.phone ?? k.email, text, k.phone ? null : `${T.COMPANY} dispatch`);
    return { detail: `Quiet since ${k.last_follow_up_at?.slice(0, 10) ?? "first contact"}: follow-up ${how}.`, status: "done" };
  },
};

const paperwork: Record<string, Handler> = {
  async rate_confirmation(c) { return loadDoc(c, "rate_confirmation"); },
  async invoice(c) { return loadDoc(c, "invoice"); },
};
async function loadDoc(c: Ctx, kind: "rate_confirmation" | "invoice"): Promise<Result> {
  const l = c.run.load_id != null ? await c.store.load(c.run.load_id) : null;
  if (!l) throw new Error(`load ${c.run.load_id} not found`);
  const d = kind === "invoice" ? T.invoice(l, c.now) : T.rateConfirmation(l);
  await c.store.saveDoc({ run_id: c.run.id, carrier_id: l.carrier_id, load_id: l.id, kind, title: d.title, body: d.body });
  return { detail: `${d.title}: drafted; ${await send(c, "email", l.carrier_email, d.body, d.title)}.`, status: "done" };
}

const summary: Record<string, Handler> = {
  async digest(c) {
    const s = T.managerSummary(await c.store.pipeline(), await c.store.stalled(), c.now);
    await c.store.saveDoc({ run_id: c.run.id, carrier_id: null, load_id: null, kind: "summary", title: s.title, body: s.body });
    const to = await c.store.adminEmails();
    const how = [];
    for (const a of to) how.push(await send(c, "email", a, s.body, s.title));
    return { detail: `${s.title}: written; ${how.length ? how.length + " admin email(s) " + (how[0] ?? "") : "no admin emails on file"}.`, status: "done" };
  },
};

const HANDLERS: Record<AgentName, Record<string, Handler>> = { onboarding, follow_up: followUp, paperwork, summary };

// ---------------------------------------------------------------- the loop
export type TickReport = { run_id: number; agent: AgentName; steps: string[]; status: RunStatus };

export async function tick(store: Store, p: Providers, opts: { now?: Date; limit?: number; env?: Record<string, string | undefined> } = {}): Promise<TickReport[]> {
  const now = opts.now ?? new Date();
  const env = opts.env ?? process.env;
  const out: TickReport[] = [];
  for (const due of await store.dueRuns(now, opts.limit ?? 25)) {
    let run: Run = due;
    const rep: TickReport = { run_id: run.id, agent: run.agent, steps: [], status: run.status };
    for (let guard = 0; guard < 12; guard++) { // advance as far as possible this tick
      const h = HANDLERS[run.agent]?.[run.step];
      if (!h) { await store.updateRun(run.id, { status: "failed" }); await store.logStep({ run_id: run.id, step: run.step, status: "failed", detail: `Unknown step "${run.step}".` }); rep.status = "failed"; break; }
      let res: Result;
      try { res = await h({ store, p, run, now, env }); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await store.logStep({ run_id: run.id, step: run.step, status: "failed", detail: msg });
        await store.updateRun(run.id, { status: "failed", context: { ...run.context, error: msg } });
        rep.status = "failed"; break;
      }
      await store.logStep({ run_id: run.id, step: run.step, status: res.stepStatus ?? "ok", detail: res.detail });
      rep.steps.push(run.step);
      const status: RunStatus = res.status ?? (res.next ? "queued" : "done");
      const patch = { step: res.next ?? run.step, status, context: { ...run.context, ...(res.context ?? {}) }, next_run_at: new Date(now.getTime() + (res.delayMin ?? 0) * 60e3).toISOString() };
      await store.updateRun(run.id, patch);
      run = { ...run, ...patch };
      rep.status = status;
      if (status !== "queued" || (res.delayMin ?? 0) > 0) break;
    }
    out.push(rep);
  }
  return out;
}

// Daily jobs (the cron calls these once a day): queue follow-ups and the summary.
export async function daily(store: Store, opts: { quietDays?: number } = {}): Promise<number> {
  let n = 0;
  for (const k of await store.quietCarriers(opts.quietDays ?? 3)) {
    if (await store.recentRun("follow_up", k.id, opts.quietDays ?? 3)) continue;
    await store.createRun({ agent: "follow_up", carrier_id: k.id, load_id: null, step: "nudge" }); n++;
  }
  await store.createRun({ agent: "summary", carrier_id: null, load_id: null, step: "digest" });
  return n + 1;
}

// ---------------------------------------------------------------- outside events
// DocuSign's webhook (or "Simulate signature" in practice mode) calls this.
export async function signatureReceived(store: Store, envelopeRef: string, now = new Date()): Promise<Run | null> {
  const run = await store.findWaitingByRef(envelopeRef);
  if (!run) return null;
  await store.logStep({ run_id: run.id, step: "await_signature", status: "ok", detail: "DocuSign: the carrier signed." });
  await store.updateRun(run.id, { step: "mark_received", status: "queued", next_run_at: now.toISOString(), context: { ...run.context, signed_at: now.toISOString() } });
  return run;
}

export async function approveDispatcher(store: Store, runId: number, dispatcherId: number, by: string, now = new Date()): Promise<void> {
  const run = await store.getRun(runId);
  if (!run || run.agent !== "onboarding" || run.step !== "await_approval") throw new Error("This run isn't waiting for a dispatcher.");
  await store.logStep({ run_id: run.id, step: "await_approval", status: "ok", detail: `${by} confirmed the dispatcher.` });
  await store.updateRun(run.id, { step: "introduce_dispatcher", status: "queued", next_run_at: now.toISOString(), context: { ...run.context, dispatcher_id: dispatcherId } });
}

export async function retryRun(store: Store, runId: number, now = new Date()): Promise<void> {
  await store.updateRun(runId, { status: "queued", next_run_at: now.toISOString() });
}

// ---------------------------------------------------------------- who to call next
// A plain, explainable score, not a black box: every point has a reason.
export function nextBest(carriers: Carrier[], now = new Date()): { carrier: Carrier; score: number; why: string }[] {
  const days = (iso: string | null) => (iso ? Math.floor((now.getTime() - new Date(iso).getTime()) / 864e5) : null);
  return carriers
    .filter(k => k.status === "Lead" || k.status === "Documents Sent")
    .map(k => {
      const why: string[] = [];
      let score = 0;
      if (k.status === "Documents Sent") { score += 40; why.push("agreement out, one step from signing"); }
      const quiet = days(k.last_follow_up_at) ?? days(k.created_at) ?? 0;
      if (quiet >= 2) { score += Math.min(quiet, 14) * 3; why.push(`${quiet} days since last contact`); }
      const sent = days(k.docs_sent_at);
      if (sent != null && sent >= 3) { score += 10; why.push(`agreement unsigned for ${sent} days`); }
      if (!k.phone && !k.email) { score -= 30; why.push("no phone or email on file"); }
      return { carrier: k, score, why: why.join("; ") || "new lead" };
    })
    .sort((a, b) => b.score - a.score);
}
