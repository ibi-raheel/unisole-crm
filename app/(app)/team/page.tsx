import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { derivePresence, PRESENCE_LABEL, timeAgo, type Presence } from "@/lib/presence";

function currentMonthParam(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}

type Agent = {
  id: number;
  real_name: string;
  alias: string | null;
  monthly_target: number;
  is_active: boolean;
};
type Dispatcher = Agent;

export default async function TeamPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return <div className="card empty">Admins only.</div>;
  }

  const supabase = await createClient();
  const month = currentMonthParam();
  const monthPrefix = month.slice(0, 7);
  const monthLabel = new Date(month).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const [
    { data: agents },
    { data: dispatchers },
    { data: salesProg },
    { data: dispProg },
    { data: carriers },
    { data: loads },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from("sales_agents")
      .select("id, real_name, alias, monthly_target, is_active")
      .order("real_name"),
    supabase
      .from("dispatchers")
      .select("id, real_name, alias, monthly_target, is_active")
      .order("real_name"),
    supabase.rpc("admin_sales_progress", { p_month: month }),
    supabase.rpc("admin_dispatcher_progress", { p_month: month }),
    supabase.from("carriers").select("sales_agent_id, dispatcher_id, status"),
    supabase.from("loads").select("dispatcher_id, load_status, pickup_date"),
    supabase
      .from("profiles")
      .select("linked_agent_id, linked_dispatcher_id, last_seen_at, last_active_at"),
  ]);

  // presence per person, keyed by their linked agent / dispatcher id
  const now = Date.now();
  const agentPresence = new Map<number, { presence: Presence; lastSeen: string | null }>();
  const dispPresence = new Map<number, { presence: Presence; lastSeen: string | null }>();
  for (const pr of (profilesData ?? []) as {
    linked_agent_id: number | null;
    linked_dispatcher_id: number | null;
    last_seen_at: string | null;
    last_active_at: string | null;
  }[]) {
    const presence = derivePresence(pr.last_seen_at, pr.last_active_at, now);
    const entry = { presence, lastSeen: pr.last_seen_at };
    if (pr.linked_agent_id) agentPresence.set(pr.linked_agent_id, entry);
    if (pr.linked_dispatcher_id) dispPresence.set(pr.linked_dispatcher_id, entry);
  }

  // this-month figures from the DB's own target functions
  const signedById = new Map<number, number>();
  for (const r of (salesProg ?? []) as { sales_agent_id: number; carriers_signed: number }[]) {
    signedById.set(r.sales_agent_id, Number(r.carriers_signed));
  }
  const earnedById = new Map<number, number>();
  for (const r of (dispProg ?? []) as { dispatcher_id: number; earned: number }[]) {
    earnedById.set(r.dispatcher_id, Number(r.earned));
  }

  // per-agent pipeline breakdown (their carriers by status)
  const agentStatus = new Map<number, Record<string, number>>();
  // per-dispatcher assigned/active carriers
  const dispAssigned = new Map<number, number>();
  const dispActive = new Map<number, number>();
  for (const c of (carriers ?? []) as {
    sales_agent_id: number | null;
    dispatcher_id: number | null;
    status: string;
  }[]) {
    if (c.sales_agent_id) {
      const m = agentStatus.get(c.sales_agent_id) ?? {};
      m[c.status] = (m[c.status] ?? 0) + 1;
      agentStatus.set(c.sales_agent_id, m);
    }
    if (c.dispatcher_id) {
      dispAssigned.set(c.dispatcher_id, (dispAssigned.get(c.dispatcher_id) ?? 0) + 1);
      if (c.status === "Active")
        dispActive.set(c.dispatcher_id, (dispActive.get(c.dispatcher_id) ?? 0) + 1);
    }
  }

  // per-dispatcher load activity
  const dispInTransit = new Map<number, number>();
  const dispDeliveredMonth = new Map<number, number>();
  for (const l of (loads ?? []) as {
    dispatcher_id: number | null;
    load_status: string;
    pickup_date: string | null;
  }[]) {
    if (!l.dispatcher_id) continue;
    if (l.load_status === "En Route")
      dispInTransit.set(l.dispatcher_id, (dispInTransit.get(l.dispatcher_id) ?? 0) + 1);
    if (l.load_status === "Delivered" && (l.pickup_date ?? "").startsWith(monthPrefix))
      dispDeliveredMonth.set(l.dispatcher_id, (dispDeliveredMonth.get(l.dispatcher_id) ?? 0) + 1);
  }

  const agentList = (agents ?? []) as Agent[];
  const dispList = (dispatchers ?? []) as Dispatcher[];

  return (
    <>
      <div className="page-head">
        <h1>Team</h1>
        <Link className="btn" href="/admin/team">
          Manage logins
        </Link>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Everyone on the team, their monthly target, and what they&apos;re working on
        right now. Targets for <strong>{monthLabel}</strong> — calculated by the
        database, never typed.
      </p>

      {/* ---- Sales team ---- */}
      <h2 className="team-heading">Sales team</h2>
      {agentList.length === 0 ? (
        <div className="card empty">No sales agents yet.</div>
      ) : (
        <div className="team-grid">
          {agentList.map((a) => {
            const signed = signedById.get(a.id) ?? 0;
            const target = Number(a.monthly_target);
            const pct = target > 0 ? Math.min(100, (signed / target) * 100) : 0;
            const done = target > 0 && signed >= target;
            const st = agentStatus.get(a.id) ?? {};
            const total = Object.values(st).reduce((s, n) => s + n, 0);
            const active = st["Active"] ?? 0;
            const open = total - active;
            return (
              <div key={a.id} className="card person-card">
                <div className="person-head">
                  <div>
                    <span className="person-name">{a.real_name}</span>
                    {a.alias && <span className="alias"> · {a.alias}</span>}
                    <PresenceTag entry={agentPresence.get(a.id)} now={now} />
                  </div>
                  {!a.is_active && <span className="inactive-tag">inactive</span>}
                </div>

                <div className="person-target">
                  <div className="person-target-row">
                    <span className="stat-label">Signed this month</span>
                    <span className="num">
                      <strong>{signed}</strong> <span className="muted">/ {target}</span>
                    </span>
                  </div>
                  <div className="meter">
                    <div className={`meter-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="work-label">
                  Working on
                  <span className="muted"> · {open} open · {active} active · {total} total</span>
                </div>
                <div className="chip-row">
                  <Chip label="Leads" n={st["Lead"] ?? 0} />
                  <Chip label="Docs sent" n={st["Documents Sent"] ?? 0} tone="sent" />
                  <Chip label="Docs rec'd" n={st["Documents Received"] ?? 0} tone="received" />
                  <Chip label="Signed" n={st["Signed — Awaiting First Load"] ?? 0} tone="awaiting" />
                  <Chip label="Active" n={active} tone="active" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Dispatch team ---- */}
      <h2 className="team-heading">Dispatch team</h2>
      {dispList.length === 0 ? (
        <div className="card empty">No dispatchers yet.</div>
      ) : (
        <div className="team-grid">
          {dispList.map((d) => {
            const earned = earnedById.get(d.id) ?? 0;
            const target = Number(d.monthly_target);
            const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
            const done = target > 0 && earned >= target;
            return (
              <div key={d.id} className="card person-card">
                <div className="person-head">
                  <div>
                    <span className="person-name">{d.real_name}</span>
                    {d.alias && <span className="alias"> · {d.alias}</span>}
                    <PresenceTag entry={dispPresence.get(d.id)} now={now} />
                  </div>
                  {!d.is_active && <span className="inactive-tag">inactive</span>}
                </div>

                <div className="person-target">
                  <div className="person-target-row">
                    <span className="stat-label">Earned this month</span>
                    <span className="num">
                      <strong>${Math.round(earned).toLocaleString()}</strong>{" "}
                      <span className="muted">/ ${Math.round(target).toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="meter">
                    <div className={`meter-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="work-label">Workload right now</div>
                <div className="chip-row">
                  <Chip label="Assigned" n={dispAssigned.get(d.id) ?? 0} />
                  <Chip label="Active" n={dispActive.get(d.id) ?? 0} tone="active" />
                  <Chip label="In transit" n={dispInTransit.get(d.id) ?? 0} tone="received" />
                  <Chip label="Delivered (mo)" n={dispDeliveredMonth.get(d.id) ?? 0} tone="sent" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PresenceTag({
  entry,
  now,
}: {
  entry?: { presence: Presence; lastSeen: string | null };
  now: number;
}) {
  const presence = entry?.presence ?? "offline";
  const title =
    presence === "offline"
      ? `Last seen ${timeAgo(entry?.lastSeen ?? null, now)}`
      : PRESENCE_LABEL[presence];
  return (
    <span className={`presence-badge presence-${presence}`} title={title}>
      <span className={`dot dot-${presence}`} />
      {PRESENCE_LABEL[presence]}
    </span>
  );
}

function Chip({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone?: "sent" | "received" | "awaiting" | "active";
}) {
  return (
    <span className={`chip${n === 0 ? " chip-zero" : ""}${tone ? ` chip-${tone}` : ""}`}>
      {label} <strong className="num">{n}</strong>
    </span>
  );
}
