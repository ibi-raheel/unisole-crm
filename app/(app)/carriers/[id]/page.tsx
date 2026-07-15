import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { LifecycleStrip } from "@/components/LifecycleStrip";
import { StatusChanger } from "@/components/StatusChanger";
import { DispatcherAssigner } from "@/components/DispatcherAssigner";
import { FollowUpModal } from "@/components/FollowUpModal";
import { DispatchNoteModal } from "@/components/DispatchNoteModal";
import { LoadStatusControl } from "@/components/LoadStatusControl";
import { MilestoneButtons } from "@/components/MilestoneButtons";

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}
function fmtDateTime(d: string | null): string {
  return d ? new Date(d).toLocaleString() : "—";
}

export default async function CarrierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carrierId = Number(id);
  const profile = await requireProfile();
  const supabase = await createClient();

  const isAdmin = profile.role === "admin";
  const canFollowUp = profile.role === "sales_agent" || isAdmin;
  const canDispatch = profile.role === "dispatcher" || isAdmin;

  const { data: carrier } = await supabase
    .from("carriers")
    .select(
      "*, truck_types(code, description), sales_agents(real_name, alias), dispatchers(real_name, alias)"
    )
    .eq("id", carrierId)
    .single();

  if (!carrier) notFound();

  const [
    { data: history },
    { data: followUps },
    { data: notes },
    { data: loads },
    { data: dispatchers },
  ] = await Promise.all([
    supabase
      .from("carrier_status_history")
      .select("*")
      .eq("carrier_id", carrierId)
      .order("changed_at", { ascending: false }),
    supabase
      .from("follow_ups")
      .select("*")
      .eq("carrier_id", carrierId)
      .order("contacted_at", { ascending: false }),
    supabase
      .from("carrier_dispatch_notes")
      .select("*")
      .eq("carrier_id", carrierId)
      .order("noted_at", { ascending: false }),
    supabase
      .from("loads")
      .select("*")
      .eq("carrier_id", carrierId)
      .order("pickup_date", { ascending: false }),
    isAdmin
      ? supabase
          .from("dispatchers")
          .select("id, real_name, alias")
          .eq("is_active", true)
          .order("real_name")
      : Promise.resolve({ data: [] as { id: number; real_name: string; alias: string | null }[] }),
  ]);

  const dispatcherOpts = (dispatchers ?? []).map((d) => ({
    id: d.id,
    label: d.alias ? `${d.real_name} (${d.alias})` : d.real_name,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13 }}>
            <Link href="/carriers">← Carriers</Link>
          </div>
          <h1>{carrier.company_name}</h1>
        </div>
        <div className="pill-row">
          <StatusBadge status={carrier.status} />
          <Link className="btn" href={`/carriers/${carrierId}/edit`}>
            Edit details
          </Link>
        </div>
      </div>

      {/* Signature element: the sale's journey */}
      <div className="card">
        <LifecycleStrip
          status={carrier.status}
          statusChangedAt={carrier.status_changed_at}
        />
      </div>

      {/* Actions */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">Actions</p>
        {canFollowUp ? (
          <div style={{ marginBottom: 12 }}>
            <label className="label">Quick milestones</label>
            <MilestoneButtons carrierId={carrierId} status={carrier.status} />
          </div>
        ) : null}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label className="label">Change status</label>
            <StatusChanger carrierId={carrierId} current={carrier.status} />
          </div>
          {isAdmin ? (
            <div>
              <label className="label">Assign dispatcher</label>
              <DispatcherAssigner
                carrierId={carrierId}
                current={carrier.dispatcher_id}
                dispatchers={dispatcherOpts}
              />
            </div>
          ) : null}
        </div>
        <div className="pill-row" style={{ marginTop: 12 }}>
          {canFollowUp ? <FollowUpModal carrierId={carrierId} /> : null}
          {canDispatch ? <DispatchNoteModal carrierId={carrierId} /> : null}
          {canDispatch ? (
            <Link className="btn" href={`/loads/new?carrier=${carrierId}`}>
              Add load
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <div className="card">
          <p className="section-title">Details</p>
          <dl className="kv">
            <dt>Contact</dt>
            <dd>{carrier.contact_person ?? "—"}</dd>
            <dt>Phone</dt>
            <dd>{carrier.phone ?? "—"}</dd>
            <dt>Email</dt>
            <dd>{carrier.email ?? "—"}</dd>
            <dt>MC number</dt>
            <dd>{carrier.mc_number ?? "—"}</dd>
            <dt>MC age</dt>
            <dd>{carrier.mc_age ?? "—"}</dd>
            <dt>Truck type</dt>
            <dd>{carrier.truck_types?.code ?? "—"}</dd>
            <dt>Lead source</dt>
            <dd>{carrier.lead_source ?? "—"}</dd>
          </dl>
        </div>
        <div className="card">
          <p className="section-title">Ownership & dates</p>
          <dl className="kv">
            <dt>Sales agent</dt>
            <dd>{carrier.sales_agents?.real_name ?? "—"}</dd>
            <dt>Dispatcher</dt>
            <dd>{carrier.dispatchers?.real_name ?? "—"}</dd>
            <dt>Docs sent</dt>
            <dd>{fmtDate(carrier.docs_sent_at)}</dd>
            <dt>Docs received</dt>
            <dd>{fmtDate(carrier.docs_received_at)}</dd>
            <dt>Assigned</dt>
            <dd>{fmtDate(carrier.date_assigned)}</dd>
            <dt>First delivery</dt>
            <dd>{fmtDate(carrier.first_load_delivered_at)}</dd>
          </dl>
        </div>
      </div>

      {/* Loads */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">Loads</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pickup</th>
                <th>Route</th>
                <th className="num">Rate</th>
                <th className="num">Earned</th>
                <th>Load</th>
                <th>Payment</th>
                {canDispatch ? <th>Update</th> : null}
              </tr>
            </thead>
            <tbody>
              {(loads ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.pickup_date)}</td>
                  <td>
                    {l.pickup_location ?? "?"} → {l.delivery_location ?? "?"}
                  </td>
                  <td className="num">${Number(l.rate).toLocaleString()}</td>
                  <td className="num">
                    ${Number(l.amount_earned).toLocaleString()}
                  </td>
                  <td>{l.load_status}</td>
                  <td>{l.payment_status}</td>
                  {canDispatch ? (
                    <td>
                      <LoadStatusControl
                        loadId={l.id}
                        carrierId={carrierId}
                        loadStatus={l.load_status}
                        paymentStatus={l.payment_status}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
              {(loads ?? []).length === 0 && (
                <tr>
                  <td colSpan={canDispatch ? 7 : 6} className="empty">
                    No loads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-ups */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">Follow-ups</p>
        {(followUps ?? []).length === 0 ? (
          <p className="empty">No follow-ups logged yet.</p>
        ) : (
          <div className="note-list">
            {(followUps ?? []).map((f) => (
              <div key={f.id} className="note-item">
                <div className="note-head">
                  <span className="note-tag">{f.type}</span>
                  <span className="muted">{fmtDateTime(f.contacted_at)}</span>
                </div>
                {f.outcome ? <div className="note-outcome">{f.outcome}</div> : null}
                {f.notes ? <div className="note-body">{f.notes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatch notes */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">Dispatch notes</p>
        {(notes ?? []).length === 0 ? (
          <p className="empty">No dispatch notes yet.</p>
        ) : (
          <div className="note-list">
            {(notes ?? []).map((n) => (
              <div key={n.id} className="note-item">
                <div className="note-head">
                  <span className="muted">{fmtDateTime(n.noted_at)}</span>
                  {n.outcome ? <span className="note-tag">{n.outcome}</span> : null}
                </div>
                {n.note ? <div className="note-body">{n.note}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status history */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">Status history</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).map((h) => (
                <tr key={h.id}>
                  <td>{fmtDateTime(h.changed_at)}</td>
                  <td>{h.old_status ?? "—"}</td>
                  <td>
                    <StatusBadge status={h.new_status} short />
                  </td>
                  <td>{h.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
