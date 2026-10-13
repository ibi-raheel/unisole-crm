// In-memory Store for the demo script and tests: the same agent code, no database.
import type { AgentDoc, AgentName, Carrier, Dispatcher, Load, Outbound, Run, StepLog, Store } from "./types.ts";

export type Memory = {
  carriers: Carrier[]; dispatchers: Dispatcher[]; loads: Load[]; admins: string[];
  runs: Run[]; steps: (StepLog & { at: string })[]; docs: AgentDoc[]; outbox: (Outbound & { at: string })[];
};

export function memoryStore(seed: Partial<Memory>, clock: () => Date = () => new Date()): Store & { mem: Memory } {
  const mem: Memory = { carriers: [], dispatchers: [], loads: [], admins: [], runs: [], steps: [], docs: [], outbox: [], ...seed };
  let id = 0;
  const iso = () => clock().toISOString();
  const statuses = ["Lead", "Documents Sent", "Documents Received", "Signed — Awaiting First Load", "Active", "No Agreement", "Dead"];
  return {
    mem,
    async dueRuns(now, limit) {
      return mem.runs.filter(r => (r.status === "queued" || r.status === "waiting") && new Date(r.next_run_at) <= now).slice(0, limit).map(r => ({ ...r }));
    },
    async getRun(i) { const r = mem.runs.find(x => x.id === i); return r ? { ...r } : null; },
    async createRun(r) {
      const run: Run = { id: ++id, status: "queued", context: {}, ...r, next_run_at: iso(), created_at: iso(), updated_at: iso() } as Run;
      mem.runs.push(run); return { ...run };
    },
    async updateRun(i, patch) { const r = mem.runs.find(x => x.id === i)!; Object.assign(r, patch, { updated_at: iso() }); },
    async recentRun(agent: AgentName, carrierId, sinceDays) {
      const since = clock().getTime() - sinceDays * 864e5;
      return mem.runs.some(r => r.agent === agent && r.carrier_id === carrierId && new Date(r.created_at).getTime() >= since);
    },
    async findWaitingByRef(ref) { const r = mem.runs.find(x => x.status === "waiting" && x.context.envelope_ref === ref); return r ? { ...r } : null; },
    async logStep(s) { mem.steps.push({ ...s, at: iso() }); },
    async saveDoc(d) { mem.docs.push(d); },
    async recordOutbound(o) { mem.outbox.push({ ...o, at: iso() }); },
    async carrier(i) { const k = mem.carriers.find(x => x.id === i); return k ? { ...k } : null; },
    async setCarrierStatus(i, s) { mem.carriers.find(x => x.id === i)!.status = s; },
    async assignDispatcher(cid, did) {
      const k = mem.carriers.find(x => x.id === cid)!;
      k.dispatcher_id = did;
      if (k.status === "Documents Received") k.status = "Signed — Awaiting First Load"; // mirrors the DB trigger
      mem.dispatchers.find(d => d.id === did)!.open_carriers++;
    },
    async dispatchers() { return mem.dispatchers.map(d => ({ ...d })); },
    async quietCarriers(days) {
      const cut = clock().getTime() - days * 864e5;
      return mem.carriers.filter(k => (k.status === "Lead" || k.status === "Documents Sent") && new Date(k.last_follow_up_at ?? k.created_at).getTime() < cut);
    },
    async load(i) { const l = mem.loads.find(x => x.id === i); return l ? { ...l } : null; },
    async pipeline() { return statuses.map(s => ({ status: s, count: mem.carriers.filter(k => k.status === s).length })); },
    async stalled() {
      return mem.carriers.filter(k => k.status === "Signed — Awaiting First Load").map(k => ({
        company_name: k.company_name, days: 0, dispatcher: mem.dispatchers.find(d => d.id === k.dispatcher_id)?.name ?? null }));
    },
    async adminEmails() { return mem.admins; },
  };
}
