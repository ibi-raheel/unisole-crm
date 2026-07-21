"use client";

import { useActionState } from "react";
import { importLeads } from "@/lib/actions/leads";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };

export function LeadImportForm({ agents }: { agents: Opt[] }) {
  const [state, action] = useActionState<FormState, FormData>(importLeads, {});

  return (
    <form action={action} className="card">
      {state.error ? <div className="error-box">{state.error}</div> : null}
      {state.message ? <div className="ok-box">{state.message}</div> : null}

      <div className="field">
        <label className="label" htmlFor="file">Spreadsheet (.xlsx or .csv) *</label>
        <input
          className="input"
          id="file"
          name="file"
          type="file"
          accept=".xlsx,.xls,.csv"
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="default_agent_id">
          Assign to agent (used for any row without an “Agent” column)
        </label>
        <select className="input" id="default_agent_id" name="default_agent_id" style={{ maxWidth: 320 }}>
          <option value="">— none —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>

      <SubmitButton>Import leads</SubmitButton>
    </form>
  );
}
