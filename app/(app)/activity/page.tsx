import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { derivePresence, PRESENCE_LABEL, timeAgo, type Presence } from "@/lib/presence";

type ProfileRow = {
  id: string;
  email: string | null;
  role: string;
  linked_agent_id: number | null;
  linked_dispatcher_id: number | null;
  is_active: boolean;
  last_seen_at: string | null;
  last_active_at: string | null;
};

type EventRow = {
  id: number;
  profile_id: string;
  kind: "login" | "logout";
  user_agent: string | null;
  created_at: string;
};

function roleLabel(role: string): string {
  return role === "sales_agent"
    ? "Sales agent"
    : role === "dispatcher"
      ? "Dispatcher"
      : role === "admin"
        ? "Admin"
        : role;
}

// Very small user-agent summariser — enough to tell devices apart.
function deviceOf(ua: string | null): string {
  if (!ua) return "—";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [browser, os].filter(Boolean).join(" · ") || "Unknown";
}

const ORDER: Record<Presence, number> = { online: 0, idle: 1, offline: 2 };

export default async function ActivityPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return <div className="card empty">Admins only.</div>;
  }

  const supabase = await createClient();
  const now = Date.now();

  const [{ data: profiles }, { data: agents }, { data: dispatchers }, { data: events }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, role, linked_agent_id, linked_dispatcher_id, is_active, last_seen_at, last_active_at"),
      supabase.from("sales_agents").select("id, real_name"),
      supabase.from("dispatchers").select("id, real_name"),
      supabase
        .from("auth_events")
        .select("id, profile_id, kind, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

  const agentName = new Map<number, string>((agents ?? []).map((a) => [a.id, a.real_name]));
  const dispName = new Map<number, string>((dispatchers ?? []).map((d) => [d.id, d.real_name]));

  const nameOf = (p?: ProfileRow): string => {
    if (!p) return "Unknown";
    if (p.linked_agent_id && agentName.has(p.linked_agent_id)) return agentName.get(p.linked_agent_id)!;
    if (p.linked_dispatcher_id && dispName.has(p.linked_dispatcher_id))
      return dispName.get(p.linked_dispatcher_id)!;
    return p.email ?? "Unknown";
  };

  const profileById = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.id, p as ProfileRow]));

  const people = ((profiles ?? []) as ProfileRow[])
    .map((p) => ({
      p,
      name: nameOf(p),
      presence: derivePresence(p.last_seen_at, p.last_active_at, now),
    }))
    .sort((a, b) => ORDER[a.presence] - ORDER[b.presence] || a.name.localeCompare(b.name));

  const onlineCount = people.filter((x) => x.presence === "online").length;
  const idleCount = people.filter((x) => x.presence === "idle").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Who&apos;s online right now, and a log of every sign-in and sign-out.
          </p>
        </div>
        <div className="pill-row">
          <span className="live-pill"><span className="dot dot-online" />{onlineCount} online</span>
          {idleCount > 0 && <span className="live-pill"><span className="dot dot-idle" />{idleCount} idle</span>}
        </div>
      </div>

      {/* Presence board */}
      <div className="card">
        <div className="section-title">Team presence</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last activity</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {people.length === 0 && (
                <tr><td colSpan={5} className="empty">No users yet.</td></tr>
              )}
              {people.map(({ p, name, presence }) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{name}</td>
                  <td className="muted">{roleLabel(p.role)}</td>
                  <td>
                    <span className={`presence-badge presence-${presence}`}>
                      <span className={`dot dot-${presence}`} />
                      {PRESENCE_LABEL[presence]}
                    </span>
                  </td>
                  <td className="muted">{timeAgo(p.last_active_at, now)}</td>
                  <td className="muted">{timeAgo(p.last_seen_at, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Login history */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Sign-in history</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Event</th>
                <th>When</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).length === 0 && (
                <tr><td colSpan={4} className="empty">No sign-in events recorded yet.</td></tr>
              )}
              {((events ?? []) as EventRow[]).map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{nameOf(profileById.get(e.profile_id))}</td>
                  <td>
                    <span className={`event-badge event-${e.kind}`}>
                      {e.kind === "login" ? "Signed in" : "Signed out"}
                    </span>
                  </td>
                  <td className="muted">
                    {new Date(e.created_at).toLocaleString()} <span style={{ opacity: 0.7 }}>· {timeAgo(e.created_at, now)}</span>
                  </td>
                  <td className="muted">{deviceOf(e.user_agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
