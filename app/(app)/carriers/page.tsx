import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { CarrierFilters } from "@/components/CarrierFilters";

const PAGE_SIZE = 50;

function daysSince(ts: string | null): string {
  if (!ts) return "—";
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
  return `${d}d`;
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
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
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

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="page-head">
        <h1>Carriers</h1>
        {profile.role === "admin" || profile.role === "sales_head" ? (
          <Link className="btn btn-primary" href="/carriers/new">
            + Add carrier
          </Link>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <CarrierFilters />
      </Suspense>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Agent</th>
                <th>Dispatcher</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/carriers/${r.id}`}>{r.company_name}</Link>
                  </td>
                  <td>
                    <StatusBadge status={r.status} short />
                  </td>
                  <td>{r.sales_agents?.real_name ?? "—"}</td>
                  <td>{r.dispatchers?.real_name ?? "—"}</td>
                  <td className="num">{daysSince(r.status_changed_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
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
          <PageLink q={q} status={status} page={page - 1} disabled={page <= 1}>
            ‹ Prev
          </PageLink>
          <span className="muted num">
            Page {page} of {totalPages}
          </span>
          <PageLink
            q={q}
            status={status}
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
  page,
  disabled,
  children,
}: {
  q: string;
  status: string;
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
  params.set("page", String(page));
  return (
    <Link className="btn" href={`/carriers?${params.toString()}`}>
      {children}
    </Link>
  );
}
