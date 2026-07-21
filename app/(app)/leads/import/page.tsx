import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LeadImportForm } from "@/components/LeadImportForm";

export default async function ImportLeadsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sales_head") {
    return <div className="card empty">Only an admin or sales head can import leads.</div>;
  }

  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("sales_agents")
    .select("id, real_name, alias")
    .eq("is_active", true)
    .order("real_name");
  const agentOpts = ((agents ?? []) as { id: number; real_name: string; alias: string | null }[]).map(
    (a) => ({ id: a.id, label: a.alias ? `${a.real_name} (${a.alias})` : a.real_name })
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Import leads</h1>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Upload an Excel or CSV of leads — each row becomes a carrier at status “Lead”.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Columns we read</div>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
          The first row must be headers. We match these (case-insensitive); extra columns are ignored:
        </p>
        <div className="chip-row">
          <span className="chip">Company <strong>*</strong></span>
          <span className="chip">Contact</span>
          <span className="chip">Phone</span>
          <span className="chip">Email</span>
          <span className="chip">MC number</span>
          <span className="chip">MC age</span>
          <span className="chip">Lead source</span>
          <span className="chip">Agent</span>
        </div>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>
          <strong>Company</strong> is required. If a row has no <strong>Agent</strong>, the default
          agent you pick below is used. Rows with no company or no agent are skipped.
        </p>
      </div>

      <LeadImportForm agents={agentOpts} />
    </>
  );
}
