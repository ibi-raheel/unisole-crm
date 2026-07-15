"use client";

import { useActionState, useState } from "react";
import { createLoad } from "@/lib/actions/loads";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };

export function LoadForm({
  carriers,
  dispatchers,
  isAdmin,
  presetCarrierId,
}: {
  carriers: Opt[];
  dispatchers: Opt[];
  isAdmin: boolean;
  presetCarrierId?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(createLoad, {});
  const [rate, setRate] = useState("");
  const [pct, setPct] = useState("0.04");

  const earned = (Number(rate) || 0) * (Number(pct) || 0);

  return (
    <form action={action} className="card">
      {state.error ? <div className="error-box">{state.error}</div> : null}

      <div className="form-row">
        {presetCarrierId ? (
          <input type="hidden" name="carrier_id" value={presetCarrierId} />
        ) : (
          <div className="field">
            <label className="label" htmlFor="carrier_id">
              Carrier *
            </label>
            <select className="input" id="carrier_id" name="carrier_id" required>
              <option value="">Choose…</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {isAdmin ? (
          <div className="field">
            <label className="label" htmlFor="dispatcher_id">
              Dispatcher *
            </label>
            <select className="input" id="dispatcher_id" name="dispatcher_id" required>
              <option value="">Choose…</option>
              {dispatchers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="pickup_date">
            Pickup date *
          </label>
          <input className="input" id="pickup_date" name="pickup_date" type="date" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="pickup_location">
            Pickup location
          </label>
          <input className="input" id="pickup_location" name="pickup_location" placeholder="City, ST" />
        </div>
        <div className="field">
          <label className="label" htmlFor="delivery_date">
            Delivery date
          </label>
          <input className="input" id="delivery_date" name="delivery_date" type="date" />
        </div>
        <div className="field">
          <label className="label" htmlFor="delivery_location">
            Delivery location
          </label>
          <input className="input" id="delivery_location" name="delivery_location" placeholder="City, ST" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="broker_name">
            Broker
          </label>
          <input className="input" id="broker_name" name="broker_name" placeholder="Brokerage / company" />
        </div>
        <div className="field">
          <label className="label" htmlFor="broker_mc">
            Broker MC#
          </label>
          <input className="input" id="broker_mc" name="broker_mc" placeholder="MC-123456" />
        </div>
        <div className="field">
          <label className="label" htmlFor="broker_contact">
            Broker contact
          </label>
          <input className="input" id="broker_contact" name="broker_contact" placeholder="Name / phone / email" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="rate">
            Rate ($) *
          </label>
          <input
            className="input num"
            id="rate"
            name="rate"
            type="number"
            step="0.01"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="service_charge_pct">
            Service charge (e.g. 0.04 = 4%) *
          </label>
          <input
            className="input num"
            id="service_charge_pct"
            name="service_charge_pct"
            type="number"
            step="0.0001"
            required
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Amount earned</label>
          <div className="stat num" style={{ fontSize: 22, paddingTop: 4 }}>
            ${earned.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="load_status">
            Load status
          </label>
          <select className="input" id="load_status" name="load_status" defaultValue="En Route">
            <option value="En Route">En Route</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="payment_status">
            Payment status
          </label>
          <select className="input" id="payment_status" name="payment_status" defaultValue="Pending">
            <option value="Pending">Pending</option>
            <option value="Invoice Created">Invoice Created</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="payment_route">
            Payment route
          </label>
          <input className="input" id="payment_route" name="payment_route" placeholder="Zelle…" />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="remarks">
          Remarks
        </label>
        <textarea className="input" id="remarks" name="remarks" rows={2} />
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Note: saving a load as <strong>Delivered</strong> automatically marks its
        carrier <strong>Active</strong>.
      </p>

      <SubmitButton>Save load</SubmitButton>
    </form>
  );
}
