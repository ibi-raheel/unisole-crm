import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReassignForm } from "@/components/ReassignForm";

export default async function ReassignPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sales_head") {
    return <div className="card empty">Only an admin or sales head can reassign carriers.</div>;
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
          <div className="muted" style={{ fontSize: 13 }}>
            <Link href="/carriers">← Carriers</Link>
          </div>
          <h1>Reassign carriers</h1>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Move an agent&rsquo;s whole book of carriers to another agent at once.
          </p>
        </div>
      </div>
      <ReassignForm agents={agentOpts} />
    </>
  );
}
