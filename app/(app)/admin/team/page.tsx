import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgentForm, DispatcherForm } from "@/components/TeamForms";
import { LoginForm } from "@/components/LoginForm";
import { TeamMemberActions, type Member } from "@/components/TeamMemberActions";

function StatusTag({ active }: { active: boolean }) {
  return active ? (
    <span className="badge badge-active">Active</span>
  ) : (
    <span className="badge badge-noagree">Inactive</span>
  );
}

export default async function TeamPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return <div className="card empty">Admins only.</div>;
  }

  const supabase = await createClient();
  const [{ data: agents }, { data: dispatchers }] = await Promise.all([
    supabase.from("sales_agents").select("*").order("real_name"),
    supabase.from("dispatchers").select("*").order("real_name"),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13 }}>
            <Link href="/admin">← Admin</Link>
          </div>
          <h1>Team</h1>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <p className="section-title">Sales agents</p>
          <AgentForm />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Alias</th>
                  <th className="num">Target</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {((agents ?? []) as Member[]).map((a) => (
                  <tr key={a.id} className={a.is_active ? "" : "row-inactive"}>
                    <td>{a.real_name}</td>
                    <td>{a.alias ?? "—"}</td>
                    <td className="num">{a.monthly_target}</td>
                    <td><StatusTag active={a.is_active} /></td>
                    <td>
                      <TeamMemberActions member={a} kind="agent" targetLabel="Monthly target (carriers)" />
                    </td>
                  </tr>
                ))}
                {(agents ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No sales agents yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <p className="section-title">Dispatchers</p>
          <DispatcherForm />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Alias</th>
                  <th className="num">Target ($)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {((dispatchers ?? []) as Member[]).map((d) => (
                  <tr key={d.id} className={d.is_active ? "" : "row-inactive"}>
                    <td>{d.real_name}</td>
                    <td>{d.alias ?? "—"}</td>
                    <td className="num">${Number(d.monthly_target).toLocaleString()}</td>
                    <td><StatusTag active={d.is_active} /></td>
                    <td>
                      <TeamMemberActions member={d} kind="dispatcher" targetLabel="Monthly target ($)" />
                    </td>
                  </tr>
                ))}
                {(dispatchers ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No dispatchers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">Create a login</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Give a team member an email + password to sign in. Pick their role, and
          link them to their agent or dispatcher record. They can log in right
          away.
        </p>
        <LoginForm
          agents={(agents ?? []).map(
            (a: { id: number; real_name: string; alias: string | null }) => ({
              id: a.id,
              label: a.alias ? `${a.real_name} (${a.alias})` : a.real_name,
            })
          )}
          dispatchers={(dispatchers ?? []).map(
            (d: { id: number; real_name: string; alias: string | null }) => ({
              id: d.id,
              label: d.alias ? `${d.real_name} (${d.alias})` : d.real_name,
            })
          )}
        />
      </div>
    </>
  );
}
