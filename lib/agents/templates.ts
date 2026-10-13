// =====================================================================
// UniSole agents — the documents and messages the agents send
// =====================================================================
// Legal terms come from ONE fixed template, never from the AI model. The
// model (when switched on) only writes friendly cover notes and gives a
// second-opinion review. TERMS below are placeholders for the business to
// confirm before go-live.
// =====================================================================

import type { Carrier, Dispatcher, Load } from "./types.ts";

export const COMPANY = "UniSole IT Hub LLC";
export const TERMS = {
  serviceChargePct: 5,        // % of each load's rate — CONFIRM with the business
  noticeDays: 14,             // either side may end the agreement with this notice
  paymentDays: 7,             // invoice due within this many days of delivery
};

const today = (d = new Date()) => d.toISOString().slice(0, 10);
const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const first = (c: Carrier) => (c.contact_person || "there").split(" ")[0];

export function contract(c: Carrier, now = new Date()): { title: string; body: string } {
  const title = `Dispatch Service Agreement — ${c.company_name}`;
  const body = [
    `DISPATCH SERVICE AGREEMENT`,
    `Date: ${today(now)}`,
    ``,
    `Between ${COMPANY} ("Dispatcher") and ${c.company_name} ("Carrier"), MC# ${c.mc_number ?? "—"}.`,
    `Carrier contact: ${c.contact_person ?? "—"} · ${c.phone ?? "—"} · ${c.email ?? "—"}`,
    `Equipment: ${c.truck_type ?? "as listed by Carrier"}`,
    ``,
    `1. Services. Dispatcher finds, negotiates and books freight loads for Carrier's trucks, and handles broker paperwork on Carrier's behalf.`,
    `2. Fee. Carrier pays Dispatcher ${TERMS.serviceChargePct}% of the gross rate of each load Dispatcher books. No fee is owed on loads Carrier books itself.`,
    `3. Carrier's choice. Carrier may decline any load. Dispatcher never books a load without Carrier's confirmation.`,
    `4. Documents. Carrier provides a current W-9, certificate of insurance and MC authority, and keeps them current.`,
    `5. Payment. Dispatcher invoices after delivery; payment is due within ${TERMS.paymentDays} days.`,
    `6. Term. This agreement continues until either side ends it with ${TERMS.noticeDays} days' written notice.`,
    ``,
    `Dispatcher: ${COMPANY}`,
    `Carrier signature: ____________________`,
  ].join("\n");
  return { title, body };
}

// The rule-based review every contract passes before it can be sent. The
// AI model (when on) adds a second opinion; it can only add issues, never
// remove these.
export function reviewContract(c: Carrier, body: string): string[] {
  const issues: string[] = [];
  if (!c.company_name?.trim()) issues.push("Company name is missing.");
  if (!c.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) issues.push("A valid email is needed to send the agreement for signature.");
  const mc = (c.mc_number || "").replace(/\D/g, "");
  if (mc.length < 4 || mc.length > 8) issues.push(`MC number "${c.mc_number ?? ""}" doesn't look valid (4–8 digits).`);
  if (/\{\{|\}\}|TODO/.test(body)) issues.push("The contract still has an unfilled placeholder.");
  if (TERMS.serviceChargePct <= 0 || TERMS.serviceChargePct > 15) issues.push("Service charge is outside 0–15%.");
  return issues;
}

export function signatureReminder(c: Carrier, n: number) {
  return `Hi ${first(c)}, a quick reminder: your ${COMPANY} dispatch agreement is waiting for your signature in DocuSign (reminder ${n} of 3). Reply here if anything in it needs a change.`;
}

export function onboardingPackage(c: Carrier): { title: string; body: string } {
  return {
    title: `Welcome to ${COMPANY} — your onboarding package`,
    body: [
      `Hi ${first(c)},`,
      ``,
      `Welcome aboard, and thank you for signing. Here's how we get your truck moving:`,
      ``,
      `1. Send us, by reply: your W-9, certificate of insurance (with us listed as certificate holder), MC authority letter, and your factoring company's notice of assignment if you use one.`,
      `2. Tell us your lanes: where you like to run, where home is, and how many days out you want to stay.`,
      `3. Meet your dispatcher: we'll introduce you in the next message. They'll call to say hello and learn your preferences.`,
      `4. How booking works: your dispatcher finds and negotiates loads, sends you the rate confirmation, and books only after you say yes.`,
      ``,
      `— The ${COMPANY} team`,
    ].join("\n"),
  };
}

export function dispatcherIntroToCarrier(c: Carrier, d: Dispatcher) {
  return `Hi ${first(c)}, meet ${d.name}, your dispatcher at ${COMPANY}. ${d.name.split(" ")[0]} will message you shortly, then call to learn your lanes and preferences. Save this number; this is your line to dispatch.`;
}
export function dispatcherBrief(c: Carrier) {
  return [
    `New carrier assigned to you: ${c.company_name} (MC# ${c.mc_number ?? "—"}).`,
    `Contact: ${c.contact_person ?? "—"} · ${c.phone ?? "—"} · ${c.email ?? "—"}`,
    `Equipment: ${c.truck_type ?? "—"} · Signed with sales agent ${c.sales_agent ?? "—"}.`,
    `The agent has sent the onboarding package and will send your hello message and place the hello call. Book their first load: they count as "Awaiting First Load" until it delivers.`,
  ].join("\n");
}
export function helloMessage(c: Carrier, d: Dispatcher) {
  return `Hi ${first(c)}, ${d.name.split(" ")[0]} here, your dispatcher at ${COMPANY}. Glad to have you with us. What lanes do you want to run this week, and where is the truck right now?`;
}
export function helloCallScript(c: Carrier, d: Dispatcher) {
  return `Hello ${first(c)}, this is the ${COMPANY} dispatch line, calling on behalf of ${d.name}, your new dispatcher. Welcome aboard. ${d.name.split(" ")[0]} will call you back today to talk through your lanes and your first load. Thank you.`;
}

export function followUpNudge(c: Carrier) {
  return c.status === "Documents Sent"
    ? `Hi ${first(c)}, checking in on the ${COMPANY} dispatch agreement we sent. Any questions I can answer so we can get your truck loaded this week?`
    : `Hi ${first(c)}, this is ${COMPANY} dispatch. We have loads moving on lanes that fit your equipment. Want us to send over the agreement so we can start booking for you?`;
}

export function rateConfirmation(l: Load): { title: string; body: string } {
  return {
    title: `Rate confirmation — load #${l.id} · ${l.carrier}`,
    body: [
      `RATE CONFIRMATION · Load #${l.id}`,
      `Carrier: ${l.carrier}`,
      `Broker: ${l.broker_name ?? "—"} (MC# ${l.broker_mc ?? "—"})`,
      `Pickup: ${l.pickup_location ?? "—"} on ${l.pickup_date}`,
      `Delivery: ${l.delivery_location ?? "—"}${l.delivery_date ? " on " + l.delivery_date : ""}`,
      `Rate: ${money(l.rate)}`,
      `Dispatcher: ${l.dispatcher ?? "—"}`,
      ``,
      `Reply YES to confirm this load.`,
    ].join("\n"),
  };
}

export function invoice(l: Load, now = new Date()): { title: string; body: string } {
  const due = new Date(now.getTime() + TERMS.paymentDays * 864e5);
  return {
    title: `Invoice — load #${l.id} · ${l.carrier}`,
    body: [
      `INVOICE · ${COMPANY}`,
      `Bill to: ${l.carrier}`,
      `Date: ${today(now)} · Due: ${today(due)}`,
      ``,
      `Dispatch service for load #${l.id}: ${l.pickup_location ?? "—"} → ${l.delivery_location ?? "—"}`,
      `Load rate ${money(l.rate)} × ${(l.service_charge_pct * 100).toFixed(2)}% = ${money(l.amount_earned)}`,
      ``,
      `Amount due: ${money(l.amount_earned)}`,
    ].join("\n"),
  };
}

export function managerSummary(pipeline: { status: string; count: number }[], stalled: { company_name: string; days: number; dispatcher: string | null }[], now = new Date()) {
  const lines = [`Pipeline on ${today(now)}:`, ...pipeline.map(p => `  ${p.status}: ${p.count}`), ``];
  if (stalled.length) {
    lines.push(`Signed but no load yet (longest first):`);
    for (const s of stalled.slice(0, 10)) lines.push(`  ${s.company_name}: ${s.days} days, dispatcher ${s.dispatcher ?? "unassigned"}`);
  } else lines.push(`No carriers are stuck in Awaiting First Load.`);
  return { title: `Daily summary — ${today(now)}`, body: lines.join("\n") };
}
