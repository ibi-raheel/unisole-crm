import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { makeProviders } from "@/lib/agents/providers";
import { nextBest } from "@/lib/agents/engine";
import type { Carrier } from "@/lib/agents/types";
import { confirmDispatcher, retryAgentRun, runAgentsNow, simulateSignature } from "@/lib/actions/agents";

// The agents, for managers: what they are doing, what is waiting on a
// person, and everything they have sent (or, in practice mode, would have).
const AGENT_LABEL: Record<string, string> = { onboarding: "Onboarding", follow_up: "Follow-up", paperwork: "Paperwork", summary: "Daily summary" };
const STEP_LABEL: Record<string, string> = {
  draft_contract: "Drafting contract", review_contract: "Reviewing contract", send_esign: "Sending DocuSign", await_signature: "Waiting for signature",
  mark_received: "Signature received", send_package: "Onboarding package", suggest_dispatcher: "Choosing dispatcher", await_approval: "Manager to confirm dispatcher",
  introduce_dispatcher: "Introducing dispatcher", hello_message: "Hello message", hello_call: "Hello call", nudge: "Follow-up", rate_confirmation: "Rate confirmation",
  invoice: "Invoice", digest: "Summary",
};
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AgentsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") return <div className="card empty">Admins only.</div>;

  const supabase = await createClient();
  const mode = makeProviders().mode;
  const [{ data: runs }, { data: outbox }, { data: dispatchers }, { data: open }, { data: last }] = await Promise.all([
    supabase.from("agent_runs").select("id, agent, status, step, context, updated_at, carriers(company_name), load_id").order("updated_at", { ascending: false }).limit(40),
    supabase.from("agent_outbox").select("id, run_id, channel, to_addr, subject, body, status, created_at").order("created_at", { ascending: false }).limit(15),
    supabase.from("dispatchers").select("id, real_name").eq("is_active", true).order("real_name"),
    supabase.from("carriers").select("id, company_name, contact_person, phone, email, mc_number, status, sales_agent_id, dispatcher_id, created_at, docs_sent_at, sales_agents(real_name)").in("status", ["Lead", "Documents Sent"]).limit(500),
    supabase.from("carrier_latest_followup").select("carrier_id, contacted_at"),
  ]);

  const lastBy = new Map((last ?? []).map((r: any) => [r.carrier_id, r.contacted_at as string]));
  const ranked = nextBest((open ?? []).map((r: any): Carrier => ({ ...r, truck_type: null, sales_agent: r.sales_agents?.real_name ?? null, last_follow_up_at: lastBy.get(r.id) ?? null }))).slice(0, 10);
  const waiting = (runs ?? []).filter((r: any) => r.status === "needs_approval" || r.status === "waiting" || r.status === "failed");
  const practiceAll = Object.values(mode).every(m => m === "practice");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="muted">They onboard new carriers, chase quiet leads, write the paperwork and summarize the day. Every step they take is logged here.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <form action={runAgentsNow}><button className="btn btn-sm">Run now</button></form>
          <form action={runAgentsNow}><input type="hidden" name="daily" value="1" /><button className="btn btn-sm">Run daily jobs</button></form>
        </div>
      </div>

      <div className={`card agent-mode${practiceAll ? " is-practice" : ""}`}>
        <strong>{practiceAll ? "Practice mode." : "Mixed mode."}</strong>{" "}
        {practiceAll ? "No keys are configured, so the agents do everything except contact the outside world. The outbox below shows exactly what they would have sent." : "Services with keys are live; the rest are in practice mode."}
        <div className="agent-modes">
          {Object.entries(mode).map(([k, m]) => <span key={k} className={`badge ${m === "live" ? "badge-active" : "badge-lead"}`}>{k}: {m}</span>)}
        </div>
      </div>

      <div className="card">
        <h2>Needs a person</h2>
        {waiting.length === 0 ? <p className="muted">Nothing is waiting on you.</p> : (
          <table className="table">
            <thead><tr><th>Carrier</th><th>Agent</th><th>Where it is</th><th></th></tr></thead>
            <tbody>
              {waiting.map((r: any) => (
                <tr key={r.id}>
                  <td><Link href={`/agents/${r.id}`}>{r.carriers?.company_name ?? `Load #${r.load_id}`}</Link></td>
                  <td>{AGENT_LABEL[r.agent]}</td>
                  <td>{STEP_LABEL[r.step] ?? r.step}{r.status === "failed" ? " · failed" : ""}{r.context?.review_issues?.length ? ` · ${r.context.review_issues[0]}` : ""}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.step === "await_approval" && (
                      <form action={confirmDispatcher} style={{ display: "inline-flex", gap: 6 }}>
                        <input type="hidden" name="run_id" value={r.id} />
                        <select name="dispatcher_id" defaultValue={r.context?.suggested_dispatcher_id}>
                          {(dispatchers ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.real_name}{d.id === r.context?.suggested_dispatcher_id ? " (suggested)" : ""}</option>)}
                        </select>
                        <button className="btn btn-sm btn-primary">Confirm</button>
                      </form>
                    )}
                    {r.step === "await_signature" && String(r.context?.envelope_ref ?? "").startsWith("practice-") && (
                      <form action={simulateSignature}><input type="hidden" name="run_id" value={r.id} /><button className="btn btn-sm">Simulate signature</button></form>
                    )}
                    {(r.status === "failed" || r.step === "review_contract") && (
                      <form action={retryAgentRun}><input type="hidden" name="run_id" value={r.id} /><button className="btn btn-sm">Retry</button></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="agent-grid">
        <div className="card">
          <h2>Recent runs</h2>
          <table className="table">
            <thead><tr><th>Job</th><th>Step</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {(runs ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td><Link href={`/agents/${r.id}`}>{AGENT_LABEL[r.agent]} · {r.carriers?.company_name ?? (r.load_id ? `Load #${r.load_id}` : "all carriers")}</Link></td>
                  <td>{STEP_LABEL[r.step] ?? r.step}</td>
                  <td><span className={`badge agent-st-${r.status}`}>{r.status.replace("_", " ")}</span></td>
                  <td className="muted">{when(r.updated_at)}</td>
                </tr>
              ))}
              {!runs?.length && <tr><td colSpan={4} className="muted">No runs yet. Move a carrier to "Documents Sent" to start one.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Who to call next</h2>
          <ol className="agent-next">
            {ranked.map(({ carrier, score, why }) => (
              <li key={carrier.id}><Link href={`/carriers/${carrier.id}`}>{carrier.company_name}</Link> <span className="muted">· {carrier.sales_agent ?? "—"} · {why}</span> <b>{score}</b></li>
            ))}
            {!ranked.length && <li className="muted">No open leads.</li>}
          </ol>
        </div>
      </div>

      <div className="card">
        <h2>Outbox</h2>
        <table className="table">
          <thead><tr><th>Channel</th><th>To</th><th>Message</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {(outbox ?? []).map((o: any) => (
              <tr key={o.id}>
                <td>{o.channel}</td><td>{o.to_addr}</td>
                <td className="agent-msg">{o.subject ? <strong>{o.subject}. </strong> : null}{o.body.slice(0, 160)}{o.body.length > 160 ? "…" : ""}</td>
                <td><span className={`badge ${o.status === "sent" ? "badge-active" : o.status === "failed" ? "badge-dead" : "badge-lead"}`}>{o.status}</span></td>
                <td className="muted">{when(o.created_at)}</td>
              </tr>
            ))}
            {!outbox?.length && <tr><td colSpan={5} className="muted">Nothing sent yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
