import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoadForm } from "@/components/LoadForm";

export default async function NewLoadPage({
  searchParams,
}: {
  searchParams: Promise<{ carrier?: string }>;
}) {
  const profile = await requireProfile();
  // Dispatchers are view-only; only admin / dispatch head can book loads.
  if (profile.role !== "admin" && profile.role !== "dispatch_head") {
    return <div className="card empty">Only an admin or dispatch head can add loads.</div>;
  }
  const sp = await searchParams;
  const preset = sp.carrier ? Number(sp.carrier) : undefined;
  const supabase = await createClient();

  const [{ data: carriers }, { data: dispatchers }] = await Promise.all([
    supabase.from("carriers").select("id, company_name").order("company_name"),
    supabase
      .from("dispatchers")
      .select("id, real_name, alias")
      .eq("is_active", true)
      .order("real_name"),
  ]);

  const carrierOpts = (carriers ?? []).map(
    (c: { id: number; company_name: string }) => ({
      id: c.id,
      label: c.company_name,
    })
  );
  const dispatcherOpts = (dispatchers ?? []).map(
    (d: { id: number; real_name: string; alias: string | null }) => ({
      id: d.id,
      label: d.alias ? `${d.real_name} (${d.alias})` : d.real_name,
    })
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13 }}>
            <Link href="/loads">← Loads</Link>
          </div>
          <h1>Add load</h1>
        </div>
      </div>
      <LoadForm
        carriers={carrierOpts}
        dispatchers={dispatcherOpts}
        isAdmin={profile.role === "admin" || profile.role === "dispatch_head"}
        presetCarrierId={preset}
      />
    </>
  );
}
