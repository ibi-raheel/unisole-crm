import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

// One agent run, start to finish: every step, every document, every message.
export default async function AgentRunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: run }, { data: steps }, { data: docs }, { data: outbox }] = await Promise.all([
    supabase.from("agent_runs").select("*, carriers(id, company_name)").eq("id", id).maybeSingle(),
    supabase.from("agent_steps").select("*").eq("run_id", id).order("created_at"),
    supabase.from("agent_documents").select("*").eq("run_id", id).order("created_at"),
    supabase.from("agent_outbox").select("*").eq("run_id", id).order("created_at"),
  ]);
  if (!run) notFound();
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="muted"><Link href="/agents">Agents</Link> / run #{run.id}</p>
          <h1>{run.agent.replace("_", "-")} · {run.carriers ? <Link href={`/carriers/${run.carriers.id}`}>{run.carriers.company_name}</Link> : run.load_id ? `Load #${run.load_id}` : "all carriers"}</h1>
        </div>
        <span className={`badge agent-st-${run.status}`}>{run.status.replace("_", " ")}</span>
      </div>

      <div className="card">
        <h2>Steps</h2>
        <ol className="agent-timeline">
          {(steps ?? []).map((s: any) => (
            <li key={s.id} className={`is-${s.status}`}>
              <div className="at-head"><strong>{s.step.replaceAll("_", " ")}</strong><span className="muted">{when(s.created_at)}</span></div>
              <p>{s.detail}</p>
            </li>
          ))}
        </ol>
      </div>

      {(docs ?? []).map((d: any) => (
        <div className="card" key={d.id}>
          <h2>{d.title}</h2>
          <pre className="agent-doc">{d.body}</pre>
        </div>
      ))}

      <div className="card">
        <h2>Messages</h2>
        <table className="table">
          <thead><tr><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>
            {(outbox ?? []).map((o: any) => (
              <tr key={o.id}><td>{o.channel}</td><td>{o.to_addr}</td><td className="agent-msg">{o.subject ? <strong>{o.subject}. </strong> : null}{o.body}</td>
                <td><span className={`badge ${o.status === "sent" ? "badge-active" : o.status === "failed" ? "badge-dead" : "badge-lead"}`}>{o.status}</span></td></tr>
            ))}
            {!outbox?.length && <tr><td colSpan={4} className="muted">No messages.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
