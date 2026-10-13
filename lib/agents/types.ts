// =====================================================================
// UniSole agents — shared shapes
// =====================================================================
// Plain types only (no enums, no classes with parameter properties), so
// every file in lib/agents also runs directly under Node for the demo
// script (`npm run agents:demo`), with no build step and no database.
// =====================================================================

export type AgentName = "onboarding" | "follow_up" | "paperwork" | "summary";

// queued         → the engine will run the run's current step on the next tick
// waiting        → paused on the outside world (a signature); resumes by webhook
// needs_approval → paused on a person (a manager confirms a dispatcher)
// done / failed  → finished
export type RunStatus = "queued" | "waiting" | "needs_approval" | "done" | "failed";

export type Run = {
  id: number;
  agent: AgentName;
  carrier_id: number | null;
  load_id: number | null;
  status: RunStatus;
  step: string;
  context: Record<string, unknown>;
  next_run_at: string;
  created_at: string;
  updated_at: string;
};

export type StepStatus = "ok" | "waiting" | "needs_approval" | "failed";
export type StepLog = { run_id: number; step: string; status: StepStatus; detail: string };

export type DocKind = "contract" | "onboarding_package" | "rate_confirmation" | "invoice" | "summary";
export type AgentDoc = {
  run_id: number;
  carrier_id: number | null;
  load_id: number | null;
  kind: DocKind;
  title: string;
  body: string;
};

export type Channel = "email" | "whatsapp" | "esign" | "call";
export type Outbound = {
  run_id: number | null;
  channel: Channel;
  to_addr: string;
  subject: string | null;
  body: string;
  status: "practice" | "sent" | "failed";
  provider_ref: string | null;
};

export type Carrier = {
  id: number;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  mc_number: string | null;
  truck_type: string | null;
  status: string;
  sales_agent_id: number;
  sales_agent: string | null;
  dispatcher_id: number | null;
  created_at: string;
  docs_sent_at: string | null;
  last_follow_up_at: string | null;
};

export type Dispatcher = {
  id: number;
  name: string;
  email: string | null;
  open_carriers: number; // carriers assigned and not yet Dead
};

export type Load = {
  id: number;
  carrier_id: number;
  carrier: string;
  carrier_email: string | null;
  dispatcher: string | null;
  pickup_date: string;
  pickup_location: string | null;
  delivery_date: string | null;
  delivery_location: string | null;
  rate: number;
  service_charge_pct: number;
  amount_earned: number;
  broker_name: string | null;
  broker_mc: string | null;
  load_status: string;
};

// Where the agents read and write. Two implementations: Supabase (the real
// CRM, via the service-role key, acting as the reserved 'system' actor) and
// memory (the demo script and tests).
export interface Store {
  dueRuns(now: Date, limit: number): Promise<Run[]>;
  getRun(id: number): Promise<Run | null>;
  createRun(r: { agent: AgentName; carrier_id: number | null; load_id: number | null; step: string; context?: Record<string, unknown> }): Promise<Run>;
  updateRun(id: number, patch: Partial<Pick<Run, "status" | "step" | "context" | "next_run_at">>): Promise<void>;
  recentRun(agent: AgentName, carrierId: number, sinceDays: number): Promise<boolean>;
  findWaitingByRef(ref: string): Promise<Run | null>;
  logStep(s: StepLog): Promise<void>;
  saveDoc(d: AgentDoc): Promise<void>;
  recordOutbound(o: Outbound): Promise<void>;

  carrier(id: number): Promise<Carrier | null>;
  setCarrierStatus(id: number, status: string): Promise<void>;
  assignDispatcher(carrierId: number, dispatcherId: number): Promise<void>;
  dispatchers(): Promise<Dispatcher[]>;
  quietCarriers(days: number): Promise<Carrier[]>;
  load(id: number): Promise<Load | null>;
  pipeline(): Promise<{ status: string; count: number }[]>;
  stalled(): Promise<{ company_name: string; days: number; dispatcher: string | null }[]>;
  adminEmails(): Promise<string[]>;
}

export type Mode = "practice" | "live";
export type SendResult = { ref: string; status: "practice" | "sent" };

// Every outside service sits behind one of these. With no key configured a
// provider runs in practice mode: it does everything except contact the
// outside world, and the CRM shows exactly what it would have sent.
export interface Providers {
  mode: { llm: Mode; esign: Mode; email: Mode; whatsapp: Mode; voice: Mode };
  llm(system: string, prompt: string): Promise<string | null>; // null in practice mode → callers use the template
  esign(input: { to: string; name: string; title: string; body: string }): Promise<SendResult>;
  email(to: string, subject: string, body: string): Promise<SendResult>;
  whatsapp(to: string, body: string): Promise<SendResult>;
  call(to: string, script: string): Promise<SendResult>;
}
