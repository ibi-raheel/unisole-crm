import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { LoadFilters } from "@/components/LoadFilters";

const PAGE_SIZE = 50;

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

type Row = {
  id: number;
  carrier_id: number;
  pickup_date: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  rate: number;
  amount_earned: number;
  load_status: string;
  payment_status: string;
  broker_name: string | null;
  broker_mc: string | null;
  carriers: { company_name: string } | null;
};

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const profile = await requireProfile();
  const canAddLoad = profile.role === "admin" || profile.role === "dispatch_head";
  const sp = await searchParams;
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .select(
      "id, carrier_id, pickup_date, pickup_location, delivery_location, rate, amount_earned, load_status, payment_status, broker_name, broker_mc, carriers(company_name)",
      { count: "exact" }
    )
    .order("pickup_date", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("load_status", status);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="page-head">
        <h1>Loads</h1>
        {canAddLoad ? (
          <Link className="btn btn-primary" href="/loads/new">
            + Add load
          </Link>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <LoadFilters />
      </Suspense>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Pickup</th>
                <th>Route</th>
                <th>Broker</th>
                <th className="num">Rate</th>
                <th className="num">Earned</th>
                <th>Load</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/carriers/${l.carrier_id}`}>
                      {l.carriers?.company_name ?? `#${l.carrier_id}`}
                    </Link>
                  </td>
                  <td>{fmtDate(l.pickup_date)}</td>
                  <td>
                    {l.pickup_location ?? "?"} → {l.delivery_location ?? "?"}
                  </td>
                  <td title={l.broker_mc ? `MC ${l.broker_mc}` : undefined}>{l.broker_name ?? "—"}</td>
                  <td className="num">${Number(l.rate).toLocaleString()}</td>
                  <td className="num">
                    ${Number(l.amount_earned).toLocaleString()}
                  </td>
                  <td>{l.load_status}</td>
                  <td>{l.payment_status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No loads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          {page > 1 ? (
            <Link
              className="btn"
              href={`/loads?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page - 1) })}`}
            >
              ‹ Prev
            </Link>
          ) : (
            <span className="btn" style={{ opacity: 0.5 }}>
              ‹ Prev
            </span>
          )}
          <span className="muted num">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              className="btn"
              href={`/loads?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page + 1) })}`}
            >
              Next ›
            </Link>
          ) : (
            <span className="btn" style={{ opacity: 0.5 }}>
              Next ›
            </span>
          )}
        </div>
      )}
    </>
  );
}
