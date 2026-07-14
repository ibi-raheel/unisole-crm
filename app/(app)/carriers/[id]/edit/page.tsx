import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EditCarrierForm } from "@/components/EditCarrierForm";

export default async function EditCarrierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [{ data: carrier }, { data: truckTypes }] = await Promise.all([
    supabase.from("carriers").select("*").eq("id", id).single(),
    supabase
      .from("truck_types")
      .select("id, code, description")
      .eq("is_active", true)
      .order("code"),
  ]);

  if (!carrier) notFound();

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
            <Link href={`/carriers/${id}`}>← {carrier.company_name}</Link>
          </div>
          <h1>Edit details</h1>
        </div>
      </div>
      <EditCarrierForm carrier={carrier} truckTypes={truckOpts} />
    </>
  );
}
