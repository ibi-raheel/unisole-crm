import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseUsState } from "@/lib/usStates";
import { LoadsFlowMap } from "@/components/LoadsFlowMap";
import { PipelineFunnel } from "@/components/PipelineFunnel";
import {
  IconCheckCircle,
  IconDoc,
  IconClock,
  IconLayers,
  IconRoute,
  IconDollar,
} from "@/components/icons";
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
      {profile.role === "sales_head" && <SalesHeadHome />}
      {profile.role === "dispatch_head" && <DispatchHeadHome />}
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

  // ==================================================================
  // ADMIN — comprehensive command center
  // ==================================================================
  async function AdminHome() {
    type LoadRow = {
      pickup_location: string | null;
      delivery_location: string | null;
      load_status: string;
      amount_earned: number | string | null;
      pickup_date: string | null;
      created_at: string;
      carriers: { company_name: string } | { company_name: string }[] | null;
    };

    const monthPrefix = month.slice(0, 7); // "YYYY-MM"

    const [
      { data: pipeline },
      { count: stalled },
      { data: loadsRaw },
      { data: dispProgress },
      { data: salesProgress },
    ] = await Promise.all([
      supabase.from("carrier_pipeline_counts").select("*"),
      supabase.from("stalled_carriers").select("carrier_id", { count: "exact", head: true }),
      supabase
        .from("loads")
        .select(
          "pickup_location,delivery_location,load_status,amount_earned,pickup_date,created_at,carriers(company_name)"
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_dispatcher_progress", { p_month: month }),
      supabase.rpc("admin_sales_progress", { p_month: month }),
    ]);

    const counts: Record<string, number> = {};
    for (const r of (pipeline ?? []) as { status: string; carriers: number }[]) {
      counts[r.status] = Number(r.carriers);
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const active = counts["Active"] ?? 0;
    const awaitingDocs = counts["Documents Sent"] ?? 0;

    const loads = (loadsRaw ?? []) as LoadRow[];
    const inTransit = loads.filter((l) => l.load_status === "En Route").length;
    const revenueMonth = loads
      .filter((l) => (l.pickup_date ?? "").startsWith(monthPrefix))
      .reduce((s, l) => s + Number(l.amount_earned ?? 0), 0);

    // Reduce loads to origin→destination state pairs for the map.
    const lanes = loads
      .map((l) => ({
        origin: parseUsState(l.pickup_location),
        dest: parseUsState(l.delivery_location),
      }))
      .filter((l): l is { origin: string; dest: string } => !!l.origin && !!l.dest);

    const carrierName = (c: LoadRow["carriers"]): string =>
      Array.isArray(c) ? c[0]?.company_name ?? "—" : c?.company_name ?? "—";

    const dispatchers = (dispProgress ?? []) as {
      dispatcher_id: number;
      real_name: string;
      monthly_target: number;
      earned: number;
    }[];
    const agents = (salesProgress ?? []) as {
      sales_agent_id: number;
      real_name: string;
      monthly_target: number;
      carriers_signed: number;
    }[];

    return (
      <>
        {/* Headline KPIs */}
        <div className="kpi-grid">
          <Kpi value={active} label="Active carriers" sub="onboarded & shipping" tone="active"
            icon={<IconCheckCircle size={20} />} />
          <Kpi value={awaitingDocs} label="Awaiting documents" sub="docs sent, not returned" tone="sent"
            icon={<IconDoc size={20} />} />
          <Kpi value={stalled ?? 0} label="Signed — not shipped" sub="stalled sales" tone="awaiting"
            href="/admin" icon={<IconClock size={20} />} />
          <Kpi value={total} label="Total carriers" sub="all statuses"
            icon={<IconLayers size={20} />} />
          <Kpi value={inTransit} label="Loads in transit" sub="en route now"
            icon={<IconRoute size={20} />} />
          <Kpi value={`$${Math.round(revenueMonth).toLocaleString()}`} label="Revenue this month"
            sub="earned on pickups" tone="active" icon={<IconDollar size={20} />} />
        </div>

        {/* The map */}
        <div style={{ marginTop: 16 }}>
          <LoadsFlowMap lanes={lanes} />
        </div>

        {/* Pipeline funnel + dispatcher leaderboard */}
        <div className="dash-2" style={{ marginTop: 16 }}>
          <PipelineFunnel counts={counts} />

          <div className="card">
            <div className="section-title">Dispatchers vs. target (this month)</div>
            {dispatchers.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No dispatchers yet.</p>
            ) : (
              dispatchers
                .slice()
                .sort((a, b) => Number(b.earned) - Number(a.earned))
                .map((d) => {
                  const earned = Number(d.earned);
                  const target = Number(d.monthly_target);
                  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
                  const done = target > 0 && earned >= target;
                  return (
                    <div key={d.dispatcher_id} className="lead-row">
                      <div className="lead-name">{d.real_name}</div>
                      <div className="lead-meter">
                        <div className="meter">
                          <div className={`meter-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="lead-val num">
                        ${Math.round(earned).toLocaleString()}
                        <span className="muted"> / ${Math.round(target).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Sales leaderboard + recent loads */}
        <div className="dash-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="section-title">Sales agents vs. target (this month)</div>
            {agents.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No sales agents yet.</p>
            ) : (
              agents
                .slice()
                .sort((a, b) => Number(b.carriers_signed) - Number(a.carriers_signed))
                .map((a) => {
                  const signed = Number(a.carriers_signed);
                  const target = Number(a.monthly_target);
                  const pct = target > 0 ? Math.min(100, (signed / target) * 100) : 0;
                  const done = target > 0 && signed >= target;
                  return (
                    <div key={a.sales_agent_id} className="lead-row">
                      <div className="lead-name">{a.real_name}</div>
                      <div className="lead-meter">
                        <div className="meter">
                          <div className={`meter-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="lead-val num">
                        {signed}
                        <span className="muted"> / {target}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div className="card">
            <div className="section-title">Recent loads</div>
            {loads.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No loads booked yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Carrier</th>
                      <th>Lane</th>
                      <th className="num">Earned</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loads.slice(0, 6).map((l, i) => (
                      <tr key={i}>
                        <td>{carrierName(l.carriers)}</td>
                        <td className="muted">
                          {(l.pickup_location ?? "?")} → {(l.delivery_location ?? "?")}
                        </td>
                        <td className="num">${Number(l.amount_earned ?? 0).toLocaleString()}</td>
                        <td>{l.load_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ==================================================================
  // SALES HEAD — sales side only (no loads / dispatch numbers)
  // ==================================================================
  async function SalesHeadHome() {
    const [{ data: pipeline }, { count: stalled }, { data: salesProgress }] =
      await Promise.all([
        supabase.from("carrier_pipeline_counts").select("*"),
        supabase.from("stalled_carriers").select("carrier_id", { count: "exact", head: true }),
        supabase.rpc("admin_sales_progress", { p_month: month }),
      ]);

    const counts: Record<string, number> = {};
    for (const r of (pipeline ?? []) as { status: string; carriers: number }[]) {
      counts[r.status] = Number(r.carriers);
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const active = counts["Active"] ?? 0;
    const awaitingDocs = counts["Documents Sent"] ?? 0;

    const agents = (salesProgress ?? []) as {
      sales_agent_id: number;
      real_name: string;
      monthly_target: number;
      carriers_signed: number;
    }[];

    return (
      <>
        <div className="kpi-grid">
          <Kpi value={active} label="Active carriers" sub="onboarded & shipping" tone="active"
            icon={<IconCheckCircle size={20} />} />
          <Kpi value={awaitingDocs} label="Awaiting documents" sub="docs sent, not returned" tone="sent"
            icon={<IconDoc size={20} />} />
          <Kpi value={stalled ?? 0} label="Signed — not shipped" sub="stalled sales" tone="awaiting"
            icon={<IconClock size={20} />} />
          <Kpi value={total} label="Total carriers" sub="all statuses"
            icon={<IconLayers size={20} />} />
        </div>

        <div className="dash-2" style={{ marginTop: 16 }}>
          <PipelineFunnel counts={counts} />
          <div className="card">
            <div className="section-title">Sales agents vs. target (this month)</div>
            {agents.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No sales agents yet.</p>
            ) : (
              agents
                .slice()
                .sort((a, b) => Number(b.carriers_signed) - Number(a.carriers_signed))
                .map((a) => {
                  const signed = Number(a.carriers_signed);
                  const target = Number(a.monthly_target);
                  const pct = target > 0 ? Math.min(100, (signed / target) * 100) : 0;
                  const done = target > 0 && signed >= target;
                  return (
                    <div key={a.sales_agent_id} className="lead-row">
                      <div className="lead-name">{a.real_name}</div>
                      <div className="lead-meter">
                        <div className="meter">
                          <div className={`meter-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="lead-val num">
                        {signed}
                        <span className="muted"> / {target}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </>
    );
  }

  // ==================================================================
  // DISPATCH HEAD — dispatch side only (no sales pipeline / agents)
  // ==================================================================
  async function DispatchHeadHome() {
    type LoadRow = {
      pickup_location: string | null;
      delivery_location: string | null;
      load_status: string;
      amount_earned: number | string | null;
      pickup_date: string | null;
      created_at: string;
      carriers: { company_name: string } | { company_name: string }[] | null;
    };
    const monthPrefix = month.slice(0, 7);

    const [{ data: pipeline }, { data: loadsRaw }, { data: dispProgress }] =
      await Promise.all([
        supabase.from("carrier_pipeline_counts").select("*"),
        supabase
          .from("loads")
          .select(
            "pickup_location,delivery_location,load_status,amount_earned,pickup_date,created_at,carriers(company_name)"
          )
          .order("created_at", { ascending: false }),
        supabase.rpc("admin_dispatcher_progress", { p_month: month }),
      ]);

    const counts: Record<string, number> = {};
    for (const r of (pipeline ?? []) as { status: string; carriers: number }[]) {
      counts[r.status] = Number(r.carriers);
    }
    const active = counts["Active"] ?? 0;

    const loads = (loadsRaw ?? []) as LoadRow[];
    const inTransit = loads.filter((l) => l.load_status === "En Route").length;
    const revenueMonth = loads
      .filter((l) => (l.pickup_date ?? "").startsWith(monthPrefix))
      .reduce((s, l) => s + Number(l.amount_earned ?? 0), 0);
    const lanes = loads
      .map((l) => ({
        origin: parseUsState(l.pickup_location),
        dest: parseUsState(l.delivery_location),
      }))
      .filter((l): l is { origin: string; dest: string } => !!l.origin && !!l.dest);
    const carrierName = (c: LoadRow["carriers"]): string =>
      Array.isArray(c) ? c[0]?.company_name ?? "—" : c?.company_name ?? "—";

    const dispatchers = (dispProgress ?? []) as {
      dispatcher_id: number;
      real_name: string;
      monthly_target: number;
      earned: number;
    }[];

    return (
      <>
        <div className="kpi-grid">
          <Kpi value={inTransit} label="Loads in transit" sub="en route now"
            icon={<IconRoute size={20} />} />
          <Kpi value={`$${Math.round(revenueMonth).toLocaleString()}`} label="Revenue this month"
            sub="earned on pickups" tone="active" icon={<IconDollar size={20} />} />
          <Kpi value={active} label="Active carriers" sub="onboarded & shipping" tone="active"
            icon={<IconCheckCircle size={20} />} />
        </div>

        <div style={{ marginTop: 16 }}>
          <LoadsFlowMap lanes={lanes} />
        </div>

        <div className="dash-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="section-title">Dispatchers vs. target (this month)</div>
            {dispatchers.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No dispatchers yet.</p>
            ) : (
              dispatchers
                .slice()
                .sort((a, b) => Number(b.earned) - Number(a.earned))
                .map((d) => {
                  const earned = Number(d.earned);
                  const target = Number(d.monthly_target);
                  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
                  const done = target > 0 && earned >= target;
                  return (
                    <div key={d.dispatcher_id} className="lead-row">
                      <div className="lead-name">{d.real_name}</div>
                      <div className="lead-meter">
                        <div className="meter">
                          <div className={`meter-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="lead-val num">
                        ${Math.round(earned).toLocaleString()}
                        <span className="muted"> / ${Math.round(target).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div className="card">
            <div className="section-title">Recent loads</div>
            {loads.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No loads booked yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Carrier</th>
                      <th>Lane</th>
                      <th className="num">Earned</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loads.slice(0, 6).map((l, i) => (
                      <tr key={i}>
                        <td>{carrierName(l.carriers)}</td>
                        <td className="muted">
                          {(l.pickup_location ?? "?")} → {(l.delivery_location ?? "?")}
                        </td>
                        <td className="num">${Number(l.amount_earned ?? 0).toLocaleString()}</td>
                        <td>{l.load_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </>
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

    type LoadRow = {
      pickup_location: string | null;
      delivery_location: string | null;
      load_status: string;
      pickup_date: string | null;
      amount_earned: number | string | null;
      carriers: { company_name: string } | { company_name: string }[] | null;
    };

    const [{ data: earned }, { data: pipeline }, { data: loadsRaw }] =
      await Promise.all([
        supabase.rpc("dispatcher_month_earned", {
          p_dispatcher_id: dispatcherId,
          p_month: month,
        }),
        supabase.from("carrier_pipeline_counts").select("*"),
        supabase
          .from("loads")
          .select(
            "pickup_location, delivery_location, load_status, pickup_date, amount_earned, carriers(company_name)"
          )
          .order("pickup_date", { ascending: false }),
      ]);

    const counts: Record<string, number> = {};
    for (const r of (pipeline ?? []) as { status: string; carriers: number }[]) {
      counts[r.status] = Number(r.carriers);
    }
    const assigned = Object.values(counts).reduce((s, n) => s + n, 0);
    const active = counts["Active"] ?? 0;

    const loads = (loadsRaw ?? []) as LoadRow[];
    const inTransit = loads.filter((l) => l.load_status === "En Route");
    const lanes = loads
      .map((l) => ({
        origin: parseUsState(l.pickup_location),
        dest: parseUsState(l.delivery_location),
      }))
      .filter((l): l is { origin: string; dest: string } => !!l.origin && !!l.dest);
    const carrierName = (c: LoadRow["carriers"]): string =>
      Array.isArray(c) ? c[0]?.company_name ?? "—" : c?.company_name ?? "—";
    const earnedNum = Number(earned ?? 0);

    const now = Date.now();
    const daysInTransit = (d: string | null): number | null =>
      d ? Math.max(0, Math.floor((now - new Date(d).getTime()) / 86_400_000)) : null;

    return (
      <>
        <div className="kpi-grid">
          <Kpi value={assigned} label="Assigned carriers" sub="in your book"
            icon={<IconLayers size={20} />} />
          <Kpi value={active} label="Active carriers" sub="picked up & shipping" tone="active"
            icon={<IconCheckCircle size={20} />} />
          <Kpi value={inTransit.length} label="Loads in transit" sub="en route now"
            icon={<IconRoute size={20} />} />
          <Kpi value={`$${Math.round(earnedNum).toLocaleString()}`} label="Earned this month"
            sub="on your loads" tone="active" icon={<IconDollar size={20} />} />
        </div>

        <div style={{ marginTop: 16 }}>
          <LoadsFlowMap lanes={lanes} />
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title">My loads · time in transit</div>
          {loads.length === 0 ? (
            <p className="empty" style={{ margin: 0 }}>No loads assigned to you yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th>Lane</th>
                    <th>Picked up</th>
                    <th className="num">In transit</th>
                    <th>Status</th>
                    <th className="num">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.slice(0, 12).map((l, i) => {
                    const days = daysInTransit(l.pickup_date);
                    return (
                      <tr key={i}>
                        <td>{carrierName(l.carriers)}</td>
                        <td className="muted">
                          {(l.pickup_location ?? "?")} → {(l.delivery_location ?? "?")}
                        </td>
                        <td className="muted">
                          {l.pickup_date ? new Date(l.pickup_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="num">
                          {l.load_status === "En Route" && days !== null
                            ? `${days} day${days === 1 ? "" : "s"}`
                            : "—"}
                        </td>
                        <td>{l.load_status}</td>
                        <td className="num">${Number(l.amount_earned ?? 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }
}

// KPI tile
function Kpi({
  value,
  label,
  sub,
  tone,
  href,
  icon,
}: {
  value: number | string;
  label: string;
  sub?: string;
  tone?: "active" | "sent" | "awaiting";
  href?: string;
  icon?: React.ReactNode;
}) {
  const body = (
    <div className={`card kpi${tone ? ` kpi-${tone}` : ""}`}>
      {icon && <div className="kpi-icon">{icon}</div>}
      <div className="num kpi-num">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="kpi-link">
      {body}
    </Link>
  ) : (
    body
  );
}
