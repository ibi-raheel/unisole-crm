"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateSalesAgent,
  updateDispatcher,
  setSalesAgentActive,
  setDispatcherActive,
} from "@/lib/actions/team";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

export type Member = {
  id: number;
  real_name: string;
  alias: string | null;
  monthly_target: number;
  is_active: boolean;
};

// Edit (modal) + activate/deactivate for one sales agent or dispatcher.
export function TeamMemberActions({
  member,
  kind,
  targetLabel,
}: {
  member: Member;
  kind: "agent" | "dispatcher";
  targetLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const updateAction = kind === "agent" ? updateSalesAgent : updateDispatcher;
  const activeAction = kind === "agent" ? setSalesAgentActive : setDispatcherActive;

  const [uState, uSubmit] = useActionState<FormState, FormData>(updateAction, {});
  const [aState, aSubmit] = useActionState<FormState, FormData>(activeAction, {});
  const router = useRouter();

  useEffect(() => {
    if (uState.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [uState.ok, router]);
  useEffect(() => {
    if (aState.ok) router.refresh();
  }, [aState.ok, router]);

  return (
    <div className="row-actions">
      <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
        Edit
      </button>
      <form action={aSubmit} style={{ display: "inline" }}>
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="active" value={member.is_active ? "false" : "true"} />
        <button className={`btn btn-sm${member.is_active ? " btn-danger" : ""}`} type="submit">
          {member.is_active ? "Deactivate" : "Reactivate"}
        </button>
      </form>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>
              Edit {kind === "agent" ? "sales agent" : "dispatcher"}
            </h2>
            {uState.error ? <div className="error-box">{uState.error}</div> : null}
            <form action={uSubmit}>
              <input type="hidden" name="id" value={member.id} />
              <div className="field">
                <label className="label">Name *</label>
                <input className="input" name="real_name" defaultValue={member.real_name} required />
              </div>
              <div className="field">
                <label className="label">Alias</label>
                <input className="input" name="alias" defaultValue={member.alias ?? ""} />
              </div>
              <div className="field">
                <label className="label">{targetLabel}</label>
                <input
                  className="input num"
                  name="monthly_target"
                  type="number"
                  step={kind === "dispatcher" ? "0.01" : "1"}
                  defaultValue={member.monthly_target}
                />
              </div>
              <div className="pill-row">
                <SubmitButton>Save changes</SubmitButton>
                <button className="btn" type="button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
