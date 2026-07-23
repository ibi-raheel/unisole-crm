"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserLogin } from "@/lib/actions/team";
import type { FormState } from "@/lib/actions/_util";
import { PasswordInput } from "./PasswordInput";
import { SubmitButton } from "./SubmitButton";

type Opt = { id: number; label: string };

export function LoginForm({
  agents,
  dispatchers,
}: {
  agents: Opt[];
  dispatchers: Opt[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    createUserLogin,
    {}
  );
  const [role, setRole] = useState("sales_agent");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRole("sales_agent");
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={action} ref={formRef}>
      {state.error ? <div className="error-box">{state.error}</div> : null}
      {state.ok ? <div className="ok-box">Login created ✓</div> : null}

      <div className="form-row">
        <div className="field">
          <label className="label">Role</label>
          <select
            className="input"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="sales_agent">Sales agent</option>
            <option value="sales_probation">Sales agent (probation)</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="sales_head">Sales head</option>
            <option value="dispatch_head">Dispatch head</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {role === "sales_agent" || role === "sales_probation" ? (
          <div className="field">
            <label className="label">For sales agent</label>
            <select className="input" name="linked_agent_id" required>
              <option value="">Choose…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {role === "dispatcher" ? (
          <div className="field">
            <label className="label">For dispatcher</label>
            <select className="input" name="linked_dispatcher_id" required>
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
          <label className="label">Email</label>
          <input className="input" name="email" type="email" required />
        </div>
        <div className="field">
          <label className="label">Password (min 8 characters)</label>
          <PasswordInput name="password" required minLength={8} />
        </div>
      </div>

      <SubmitButton>Create login</SubmitButton>
    </form>
  );
}
