import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

function currentMonthParam(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const month = currentMonthParam();

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      {profile.role === "admin" && <AdminHome />}
      {profile.role === "sales_agent" && (
        <SalesHome agentId={profile.linked_agent_id} month={month} />
      )}
      {profile.role === "dispatcher" && (
        <DispatcherHome
          dispatcherId={profile.linked_dispatcher_id}
          month={month}
        />
      )}
    </>
  );

  async function AdminHome() {
    const [{ data: pipeline }, { count: stalled }] = await Promise.all([
      supabase.from("carrier_pipeline_counts").select("*"),
      supabase
        .from("stalled_carriers")
        .select("carrier_id", { count: "exact", head: true }),
    ]);

    const total = (pipeline ?? []).reduce(
      (s: number, r: { carriers: number }) => s + Number(r.carriers),
      0
    );

    return (
      <div className="grid grid-3">
        <div className="card">
          <div className="stat num">{total}</div>
          <div className="stat-label">Carriers total</div>
        </div>
        <div className="card">
          <div className="stat num">{stalled ?? 0}</div>
          <div className="stat-label">Signed but not shipped</div>
          <div style={{ marginTop: 8 }}>
            <Link href="/admin">View stalled sales →</Link>
          </div>
        </div>
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>
            Pipeline
          </div>
          {(pipeline ?? []).map((r: { status: string; carriers: number }) => (
            <div
              key={r.status}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span className="muted">{r.status}</span>
              <span className="num">{r.carriers}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function SalesHome({
    agentId,
    month,
  }: {
    agentId: number | null;
    month: string;
  }) {
    if (!agentId)
      return <div className="card empty">No sales agent is linked to your login.</div>;

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: signed }, { data: agent }, { data: pipeline }, { count: dueCount }] =
      await Promise.all([
        supabase.rpc("sales_agent_month_signed", {
          p_agent_id: agentId,
          p_month: month,
        }),
        supabase
          .from("sales_agents")
          .select("real_name, monthly_target")
          .eq("id", agentId)
          .single(),
        supabase.from("carrier_pipeline_counts").select("*"),
        supabase
          .from("follow_ups")
          .select("id", { count: "exact", head: true })
          .lte("next_followup_date", today),
      ]);

    const target = Number(agent?.monthly_target ?? 0);
    const signedNum = Number(signed ?? 0);
    const pct = target > 0 ? Math.min(100, (signedNum / target) * 100) : 0;
    const done = target > 0 && signedNum >= target;

    return (
      <div className="grid grid-3">
        <div className="card">
          <div className="stat-label">Carriers signed this month</div>
          <div className="stat num">
            {signedNum}
            <span className="muted" style={{ fontSize: 18 }}>
              {" "}
              / {target}
            </span>
          </div>
          <div className="meter" style={{ marginTop: 8 }}>
            <div
              className={`meter-fill${done ? " done" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>
            My carriers by status
          </div>
          {(pipeline ?? []).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No open carriers yet.
            </p>
          ) : (
            (pipeline ?? []).map((r: { status: string; carriers: number }) => (
              <div
                key={r.status}
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span className="muted">{r.status}</span>
                <span className="num">{r.carriers}</span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="stat-label">Follow-ups due (today or overdue)</div>
          <div className="stat num">{dueCount ?? 0}</div>
          <div style={{ marginTop: 8 }}>
            <Link href="/carriers">My carriers →</Link>
          </div>
        </div>
      </div>
    );
  }

  async function DispatcherHome({
    dispatcherId,
    month,
  }: {
    dispatcherId: number | null;
    month: string;
  }) {
    if (!dispatcherId)
      return (
        <div className="card empty">No dispatcher is linked to your login.</div>
      );

    const [{ data: earned }, { data: disp }, { data: pipeline }] =
      await Promise.all([
        supabase.rpc("dispatcher_month_earned", {
          p_dispatcher_id: dispatcherId,
          p_month: month,
        }),
        supabase
          .from("dispatchers")
          .select("real_name, monthly_target")
          .eq("id", dispatcherId)
          .single(),
        supabase.from("carrier_pipeline_counts").select("*"),
      ]);

    const target = Number(disp?.monthly_target ?? 0);
    const earnedNum = Number(earned ?? 0);
    const pct = target > 0 ? Math.min(100, (earnedNum / target) * 100) : 0;
    const done = target > 0 && earnedNum >= target;

    return (
      <div className="grid grid-3">
        <div className="card">
          <div className="stat-label">Earned this month</div>
          <div className="stat num">
            ${earnedNum.toLocaleString()}
            <span className="muted" style={{ fontSize: 18 }}>
              {" "}
              / ${target.toLocaleString()}
            </span>
          </div>
          <div className="meter" style={{ marginTop: 8 }}>
            <div
              className={`meter-fill${done ? " done" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>
            My carriers by status
          </div>
          {(pipeline ?? []).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No assigned carriers yet.
            </p>
          ) : (
            (pipeline ?? []).map((r: { status: string; carriers: number }) => (
              <div
                key={r.status}
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span className="muted">{r.status}</span>
                <span className="num">{r.carriers}</span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>
            Quick links
          </div>
          <div>
            <Link href="/carriers">My carriers →</Link>
          </div>
          <div>
            <Link href="/loads">My loads →</Link>
          </div>
        </div>
      </div>
    );
  }
}
