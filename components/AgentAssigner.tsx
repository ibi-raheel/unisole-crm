"use client";

import { useActionState } from "react";
import { assignSalesAgent } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };

// Reassign a carrier's sales agent — shown only to admin / sales_head.
export function AgentAssigner({
  carrierId,
  current,
  agents,
}: {
  carrierId: number;
  current: number | null;
  agents: Opt[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    assignSalesAgent,
    {}
  );

  return (
    <form action={action}>
      <div className="pill-row">
        <input type="hidden" name="carrier_id" value={carrierId} />
        <select
          className="input"
          name="sales_agent_id"
          defaultValue={current ?? ""}
          style={{ maxWidth: 260 }}
        >
          <option value="">Choose…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <SubmitButton className="btn">Reassign</SubmitButton>
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
