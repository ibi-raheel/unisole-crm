"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { reassignAllCarriers } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";
import { useEffect } from "react";

type Opt = { id: number; label: string };

export function ReassignForm({ agents }: { agents: Opt[] }) {
  const [state, action] = useActionState<FormState, FormData>(reassignAllCarriers, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="card">
      {state.error ? <div className="error-box">{state.error}</div> : null}
      {state.message ? <div className="ok-box">{state.message}</div> : null}

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="from_agent_id">Move all carriers from *</label>
          <select className="input" id="from_agent_id" name="from_agent_id" required>
            <option value="">Choose agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="to_agent_id">To agent *</label>
          <select className="input" id="to_agent_id" name="to_agent_id" required>
            <option value="">Choose agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Carriers at <strong>Documents Sent</strong>, <strong>Documents Received</strong>,{" "}
        <strong>Signed</strong>, or <strong>Active</strong> are left with the original agent.
        Only fresh leads move. Every move is logged.
      </p>

      <SubmitButton>Reassign carriers</SubmitButton>
    </form>
  );
}
