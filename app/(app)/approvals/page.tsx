import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApprovalActions } from "@/components/ApprovalActions";

const KIND_LABEL: Record<string, string> = {
  create_carrier: "New carrier",
  create_load: "New load",
  set_load_status: "Load status change",
  set_carrier_status: "Carrier status change",
};

function fmtDateTime(d: string | null): string {
  return d ? new Date(d).toLocaleString() : "—";
}

type Req = {
  id: number;
  kind: string;
  summary: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  requested_by: string;
};

export default async function ApprovalsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return <div className="card empty">Admins only.</div>;
  }
  const supabase = await createClient();

  const [{ data: pendingRaw }, { data: recentRaw }] = await Promise.all([
    supabase
      .from("change_requests")
      .select("id, kind, summary, status, created_at, reviewed_at, requested_by")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("change_requests")
      .select("id, kind, summary, status, created_at, reviewed_at, requested_by")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(15),
  ]);

  const pending = (pendingRaw ?? []) as Req[];
  const recent = (recentRaw ?? []) as Req[];

  // Resolve requester emails (admin can read all profiles).
  const ids = [...new Set([...pending, ...recent].map((r) => r.requested_by))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, email").in("id", ids)
    : { data: [] as { id: string; email: string | null }[] };
  const emailById = new Map((people ?? []).map((p) => [p.id, p.email ?? "—"]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Changes requested by the team. Approving applies the change to the system.
          </p>
        </div>
        {pending.length > 0 && (
          <span className="live-pill">
            <span className="dot dot-idle" />
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="card">
        <div className="section-title">Pending</div>
        {pending.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>Nothing waiting for approval. 🎉</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Requested by</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td>{r.summary ?? "—"}</td>
                    <td className="muted">{emailById.get(r.requested_by) ?? "—"}</td>
                    <td className="muted">{fmtDateTime(r.created_at)}</td>
                    <td>
                      <ApprovalActions requestId={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Recently reviewed</div>
        {recent.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>No history yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Requested by</th>
                  <th>Outcome</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td>{r.summary ?? "—"}</td>
                    <td className="muted">{emailById.get(r.requested_by) ?? "—"}</td>
                    <td>
                      <span className={`badge ${r.status === "approved" ? "badge-active" : "badge-dead"}`}>
                        {r.status === "approved" ? "Approved" : "Rejected"}
                      </span>
                    </td>
                    <td className="muted">{fmtDateTime(r.reviewed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
