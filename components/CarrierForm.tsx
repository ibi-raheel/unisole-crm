"use client";

import { useActionState } from "react";
import { createCarrier } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };

export function CarrierForm({
  agents,
  truckTypes,
  isAdmin,
}: {
  agents: Opt[];
  truckTypes: Opt[];
  isAdmin: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    createCarrier,
    {}
  );

  return (
    <form action={action} className="card">
      {state.error ? <div className="error-box">{state.error}</div> : null}

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="company_name">
            Company name *
          </label>
          <input className="input" id="company_name" name="company_name" required />
        </div>
        {isAdmin ? (
          <div className="field">
            <label className="label" htmlFor="sales_agent_id">
              Sales agent *
            </label>
            <select className="input" id="sales_agent_id" name="sales_agent_id" required>
              <option value="">Choose…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="contact_person">
            Contact person
          </label>
          <input className="input" id="contact_person" name="contact_person" />
        </div>
        <div className="field">
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input className="input" id="phone" name="phone" />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="mc_number">
            MC number
          </label>
          <input className="input" id="mc_number" name="mc_number" />
        </div>
        <div className="field">
          <label className="label" htmlFor="mc_age">
            MC age
          </label>
          <input className="input" id="mc_age" name="mc_age" placeholder="e.g. 8M" />
        </div>
        <div className="field">
          <label className="label" htmlFor="truck_type_id">
            Truck type
          </label>
          <select className="input" id="truck_type_id" name="truck_type_id">
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
          <label className="label" htmlFor="lead_source">
            Lead source
          </label>
          <input className="input" id="lead_source" name="lead_source" placeholder="Cold call, referral…" />
        </div>
        <div className="field">
          <label className="label" htmlFor="docs_sent_at">
            Docs sent
          </label>
          <input className="input" id="docs_sent_at" name="docs_sent_at" type="date" />
        </div>
        <div className="field">
          <label className="label" htmlFor="docs_received_at">
            Docs received
          </label>
          <input className="input" id="docs_received_at" name="docs_received_at" type="date" />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="remarks">
          Remarks
        </label>
        <textarea className="input" id="remarks" name="remarks" rows={2} />
      </div>

      <SubmitButton>Save carrier</SubmitButton>
    </form>
  );
}
