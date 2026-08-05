import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { CarrierFilters } from "@/components/CarrierFilters";
import { CARRIER_STATUSES } from "@/lib/status";

const PAGE_SIZE = 50;

function ageInDays(ts: string | null): number | null {
  return ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000) : null;
}
function daysSince(ts: string | null): string {
  const d = ageInDays(ts);
  return d == null ? "—" : `${d}d`;
}

// [warn, stale] day thresholds per status. Keys use the canonical constants
// (byte-exact em-dash). Statuses not listed (Active/Dead/No Agreement) never age.
const AGING: Record<string, [number, number]> = {
  [CARRIER_STATUSES[0]]: [7, 14], // Lead
  [CARRIER_STATUSES[1]]: [5, 10], // Documents Sent
  [CARRIER_STATUSES[2]]: [5, 10], // Documents Received
  [CARRIER_STATUSES[3]]: [10, 21], // Signed — Awaiting First Load
};
function agingLevel(status: string, ts: string | null): "ok" | "warn" | "stale" {
  const days = ageInDays(ts);
  const t = AGING[status];
  if (days == null || !t) return "ok";
  if (days >= t[1]) return "stale";
  if (days >= t[0]) return "warn";
  return "ok";
}

type Row = {
  id: number;
  company_name: string;
  status: string;
  status_changed_at: string | null;
  sales_agents: { real_name: string } | null;
  dispatchers: { real_name: string } | null;
};

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; dispatcher?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const dispatcher = sp.dispatcher ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  // The current list state, so opening a lead and coming back returns to the
  // exact same page/filters (fixes "update a lead → jump to page 1").
  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (status) listParams.set("status", status);
  if (dispatcher) listParams.set("dispatcher", dispatcher);
  if (page > 1) listParams.set("page", String(page));
  const listQuery = listParams.toString();
  const carrierHref = (id: number) =>
    listQuery ? `/carriers/${id}?from=${encodeURIComponent(listQuery)}` : `/carriers/${id}`;

  const supabase = await createClient();

  // The dispatch head / admin can filter carriers by dispatcher.
  const showDispatcherFilter =
    profile.role === "admin" || profile.role === "dispatch_head";
  const { data: dispatchersRaw } = showDispatcherFilter
    ? await supabase
        .from("dispatchers")
        .select("id, real_name, alias")
        .eq("is_active", true)
        .order("real_name")
    : { data: [] as { id: number; real_name: string; alias: string | null }[] };
  const dispatcherOpts = (dispatchersRaw ?? []).map((d) => ({
    id: d.id,
    label: d.alias ? `${d.real_name} (${d.alias})` : d.real_name,
  }));

  let query = supabase
    .from("carriers")
    .select(
      "id, company_name, status, status_changed_at, sales_agents(real_name), dispatchers(real_name)",
      { count: "exact" }
    )
    .order("status_changed_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (q) query = query.ilike("company_name", `%${q}%`);
  if (status) query = query.eq("status", status);
  if (dispatcher === "none") query = query.is("dispatcher_id", null);
  else if (dispatcher) query = query.eq("dispatcher_id", Number(dispatcher));

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Latest follow-up per visible carrier (RLS limits which follow-ups the
  // viewer can read; carriers with none, or that they can't read, show "—").
  const carrierIds = rows.map((r) => r.id);
  const { data: fuData } = carrierIds.length
    ? await supabase
        .from("carrier_latest_followup")
        .select("carrier_id, type, contacted_at")
        .in("carrier_id", carrierIds)
    : { data: [] as { carrier_id: number; type: string; contacted_at: string | null }[] };
  const latestFollowUp = new Map<number, { type: string; contacted_at: string | null }>();
  for (const f of fuData ?? []) {
    if (!latestFollowUp.has(f.carrier_id)) {
      latestFollowUp.set(f.carrier_id, { type: f.type, contacted_at: f.contacted_at });
    }
  }
  const fmtShort = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

  return (
    <>
      <div className="page-head">
        <h1>Carriers</h1>
        {profile.role === "admin" || profile.role === "sales_head" ? (
          <div className="pill-row">
            <Link className="btn" href="/reassign">
              Reassign
            </Link>
            <Link className="btn btn-primary" href="/carriers/new">
              + Add carrier
            </Link>
          </div>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <CarrierFilters dispatchers={dispatcherOpts} />
      </Suspense>

      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        {count ?? 0} carrier{(count ?? 0) === 1 ? "" : "s"}
        {dispatcher && dispatcher !== "none"
          ? ` assigned to ${dispatcherOpts.find((d) => String(d.id) === dispatcher)?.label ?? "this dispatcher"}`
          : dispatcher === "none"
            ? " with no dispatcher"
            : ""}
      </p>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Agent</th>
                <th>Dispatcher</th>
                <th>Latest follow-up</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fu = latestFollowUp.get(r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={carrierHref(r.id)}>{r.company_name}</Link>
                    </td>
                    <td>
                      <StatusBadge status={r.status} short />
                    </td>
                    <td>{r.sales_agents?.real_name ?? "—"}</td>
                    <td>{r.dispatchers?.real_name ?? "—"}</td>
                    <td className="muted">
                      {fu ? `${fu.type} · ${fmtShort(fu.contacted_at)}` : "—"}
                    </td>
                    <td className={`num age-${agingLevel(r.status, r.status_changed_at)}`}>
                      {daysSince(r.status_changed_at)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No carriers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <PageLink q={q} status={status} dispatcher={dispatcher} page={page - 1} disabled={page <= 1}>
            ‹ Prev
          </PageLink>
          <span className="muted num">
            Page {page} of {totalPages}
          </span>
          <PageLink
            q={q}
            status={status}
            dispatcher={dispatcher}
            page={page + 1}
            disabled={page >= totalPages}
          >
            Next ›
          </PageLink>
        </div>
      )}
    </>
  );
}

function PageLink({
  q,
  status,
  dispatcher,
  page,
  disabled,
  children,
}: {
  q: string;
  status: string;
  dispatcher: string;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled)
    return (
      <span className="btn" style={{ opacity: 0.5, pointerEvents: "none" }}>
        {children}
      </span>
    );
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (dispatcher) params.set("dispatcher", dispatcher);
  params.set("page", String(page));
  return (
    <Link className="btn" href={`/carriers?${params.toString()}`}>
      {children}
    </Link>
  );
}
