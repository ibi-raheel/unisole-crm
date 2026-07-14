"use client";

import { useActionState } from "react";
import { assignDispatcher } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };

export function DispatcherAssigner({
  carrierId,
  current,
  dispatchers,
}: {
  carrierId: number;
  current: number | null;
  dispatchers: Opt[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    assignDispatcher,
    {}
  );

  return (
    <form action={action}>
      <div className="pill-row">
        <input type="hidden" name="carrier_id" value={carrierId} />
        <select
          className="input"
          name="dispatcher_id"
          defaultValue={current ?? ""}
          style={{ maxWidth: 260 }}
        >
          <option value="">— none —</option>
          {dispatchers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <SubmitButton className="btn">Assign</SubmitButton>
        {state.ok ? <span className="muted">Saved ✓</span> : null}
      </div>
      {state.error ? (
        <div className="error-box" style={{ marginTop: 8 }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
