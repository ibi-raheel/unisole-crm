"use client";

import { useActionState } from "react";
import { updateCarrierDetails } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };
type Carrier = {
  id: number;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  mc_number: string | null;
  mc_age: string | null;
  truck_type_id: number | null;
  lead_source: string | null;
  docs_sent_at: string | null;
  docs_received_at: string | null;
  remarks: string | null;
};

export function EditCarrierForm({
  carrier,
  truckTypes,
}: {
  carrier: Carrier;
  truckTypes: Opt[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    updateCarrierDetails,
    {}
  );

  return (
    <form action={action} className="card">
      {state.error ? <div className="error-box">{state.error}</div> : null}
      <input type="hidden" name="carrier_id" value={carrier.id} />

      <div className="form-row">
        <div className="field">
          <label className="label">Contact person</label>
          <input className="input" name="contact_person" defaultValue={carrier.contact_person ?? ""} />
        </div>
        <div className="field">
          <label className="label">Phone</label>
          <input className="input" name="phone" defaultValue={carrier.phone ?? ""} />
        </div>
        <div className="field">
          <label className="label">Email</label>
          <input className="input" name="email" type="email" defaultValue={carrier.email ?? ""} />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label">MC number</label>
          <input className="input" name="mc_number" defaultValue={carrier.mc_number ?? ""} />
        </div>
        <div className="field">
          <label className="label">MC age</label>
          <input className="input" name="mc_age" defaultValue={carrier.mc_age ?? ""} />
        </div>
        <div className="field">
          <label className="label">Truck type</label>
          <select className="input" name="truck_type_id" defaultValue={carrier.truck_type_id ?? ""}>
            <option value="">—</option>
            {truckTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label">Lead source</label>
          <input className="input" name="lead_source" defaultValue={carrier.lead_source ?? ""} />
        </div>
        <div className="field">
          <label className="label">Docs sent</label>
          <input className="input" name="docs_sent_at" type="date" defaultValue={carrier.docs_sent_at ?? ""} />
        </div>
        <div className="field">
          <label className="label">Docs received</label>
          <input className="input" name="docs_received_at" type="date" defaultValue={carrier.docs_received_at ?? ""} />
        </div>
      </div>

      <div className="field">
        <label className="label">Remarks</label>
        <textarea className="input" name="remarks" rows={2} defaultValue={carrier.remarks ?? ""} />
      </div>

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
