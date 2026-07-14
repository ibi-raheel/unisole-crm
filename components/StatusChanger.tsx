"use client";

import { useActionState } from "react";
import { setCarrierStatus } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";
import { MANUAL_STATUSES } from "@/lib/status";
import { SubmitButton } from "./SubmitButton";

export function StatusChanger({
  carrierId,
  current,
}: {
  carrierId: number;
  current: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    setCarrierStatus,
    {}
  );

  // Only offer statuses a human can set. If the carrier is currently in an
  // automatic status (Active / Awaiting), show it too so the box reads right.
  const manual = MANUAL_STATUSES as unknown as string[];
  const options = manual.includes(current) ? manual : [current, ...manual];

  return (
    <form action={action}>
      <div className="pill-row">
        <input type="hidden" name="carrier_id" value={carrierId} />
        <select
          className="input"
          name="status"
          defaultValue={current}
          style={{ maxWidth: 260 }}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <SubmitButton className="btn">Update status</SubmitButton>
        {state.ok ? <span className="muted">Saved ✓</span> : null}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        &ldquo;Awaiting first load&rdquo; and &ldquo;Active&rdquo; aren&rsquo;t
        here — they happen on their own (assign a dispatcher, or deliver a load).
      </p>
      {state.error ? (
        <div className="error-box" style={{ marginTop: 8 }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
