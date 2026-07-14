import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CarrierForm } from "@/components/CarrierForm";

export default async function NewCarrierPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: agents }, { data: truckTypes }] = await Promise.all([
    supabase
      .from("sales_agents")
      .select("id, real_name, alias")
      .eq("is_active", true)
      .order("real_name"),
    supabase
      .from("truck_types")
      .select("id, code, description")
      .eq("is_active", true)
      .order("code"),
  ]);

  const agentOpts = (agents ?? []).map(
    (a: { id: number; real_name: string; alias: string | null }) => ({
      id: a.id,
      label: a.alias ? `${a.real_name} (${a.alias})` : a.real_name,
    })
  );
  const truckOpts = (truckTypes ?? []).map(
    (t: { id: number; code: string; description: string | null }) => ({
      id: t.id,
      label: t.description ? `${t.code} — ${t.description}` : t.code,
    })
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13 }}>
            <Link href="/carriers">← Carriers</Link>
          </div>
          <h1>Add carrier</h1>
        </div>
      </div>
      <CarrierForm
        agents={agentOpts}
        truckTypes={truckOpts}
        isAdmin={profile.role === "admin"}
      />
    </>
  );
}
