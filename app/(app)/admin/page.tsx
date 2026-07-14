import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

function currentMonthParam(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function AdminPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return <div className="card empty">Admins only.</div>;
  }

  const supabase = await createClient();
  const month = currentMonthParam();
  const monthLabel = new Date(month).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const [{ data: stalled }, { data: sales }, { data: dispatch }] =
    await Promise.all([
      supabase.from("stalled_carriers").select("*"),
      supabase.rpc("admin_sales_progress", { p_month: month }),
      supabase.rpc("admin_dispatcher_progress", { p_month: month }),
    ]);

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
        <Link className="btn" href="/admin/team">
          Manage team
        </Link>
      </div>

      {/* Headline metric: stalled sales */}
      <div className="card">
        <p className="section-title">
          Stalled sales — signed but never shipped
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Dispatcher</th>
                <th>Sales agent</th>
                <th className="num">Days stalled</th>
              </tr>
            </thead>
            <tbody>
              {(stalled ?? []).map(
                (s: {
                  carrier_id: number;
                  company_name: string;
                  dispatcher_name: string | null;
                  sales_agent_name: string | null;
                  days_stalled: number;
                }) => (
                  <tr key={s.carrier_id}>
                    <td>
                      <Link href={`/carriers/${s.carrier_id}`}>
                        {s.company_name}
                      </Link>
                    </td>
                    <td>{s.dispatcher_name ?? "—"}</td>
                    <td>{s.sales_agent_name ?? "—"}</td>
                    <td className="num">{s.days_stalled}</td>
                  </tr>
                )
              )}
              {(stalled ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    No carriers are stuck awaiting their first load. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 style={{ marginTop: 24, marginBottom: 4 }}>Targets — {monthLabel}</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Calculated automatically, never typed. A <strong>sales agent</strong> is
        credited for each carrier whose documents were received this month. A{" "}
        <strong>dispatcher</strong> earns the service charge on loads picked up
        this month.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 8 }}>
        <div className="card">
          <p className="section-title">Sales agents — carriers signed</p>
          {(sales ?? []).length === 0 ? (
            <p className="empty">No active sales agents yet.</p>
          ) : (
            (sales ?? []).map(
              (r: {
                sales_agent_id: number;
                real_name: string;
                monthly_target: number;
                carriers_signed: number;
              }) => {
                const pct =
                  r.monthly_target > 0
                    ? Math.min(100, (r.carriers_signed / r.monthly_target) * 100)
                    : 0;
                const done =
                  r.monthly_target > 0 &&
                  r.carriers_signed >= r.monthly_target;
                return (
                  <div key={r.sales_agent_id} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span>{r.real_name}</span>
                      <span className="num">
                        <strong>{r.carriers_signed}</strong> /{" "}
                        {r.monthly_target}
                      </span>
                    </div>
                    <div className="meter">
                      <div
                        className={`meter-fill${done ? " done" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>

        <div className="card">
          <p className="section-title">Dispatchers — money earned</p>
          {(dispatch ?? []).length === 0 ? (
            <p className="empty">No active dispatchers yet.</p>
          ) : (
            (dispatch ?? []).map(
              (r: {
                dispatcher_id: number;
                real_name: string;
                monthly_target: number;
                earned: number;
              }) => {
                const earned = Number(r.earned);
                const target = Number(r.monthly_target);
                const pct =
                  target > 0 ? Math.min(100, (earned / target) * 100) : 0;
                const done = target > 0 && earned >= target;
                return (
                  <div key={r.dispatcher_id} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span>{r.real_name}</span>
                      <span className="num">
                        <strong>${earned.toLocaleString()}</strong> / $
                        {target.toLocaleString()}
                      </span>
                    </div>
                    <div className="meter">
                      <div
                        className={`meter-fill${done ? " done" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      </div>
    </>
  );
}
