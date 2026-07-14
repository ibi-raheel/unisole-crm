"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSalesAgent, createDispatcher } from "@/lib/actions/team";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

function useRefreshOnOk(ok: boolean | undefined, formRef: React.RefObject<HTMLFormElement | null>) {
  const router = useRouter();
  useEffect(() => {
    if (ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [ok, router, formRef]);
}

export function AgentForm() {
  const [state, action] = useActionState<FormState, FormData>(
    createSalesAgent,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnOk(state.ok, formRef);

  return (
    <form action={action} ref={formRef}>
      {state.error ? <div className="error-box">{state.error}</div> : null}
      <div className="form-row">
        <div className="field">
          <label className="label">Name *</label>
          <input className="input" name="real_name" required />
        </div>
        <div className="field">
          <label className="label">Alias</label>
          <input className="input" name="alias" placeholder="US codename" />
        </div>
        <div className="field">
          <label className="label">Monthly target (carriers)</label>
          <input className="input num" name="monthly_target" type="number" defaultValue={0} />
        </div>
      </div>
      <SubmitButton>Add sales agent</SubmitButton>
    </form>
  );
}

export function DispatcherForm() {
  const [state, action] = useActionState<FormState, FormData>(
    createDispatcher,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnOk(state.ok, formRef);

  return (
    <form action={action} ref={formRef}>
      {state.error ? <div className="error-box">{state.error}</div> : null}
      <div className="form-row">
        <div className="field">
          <label className="label">Name *</label>
          <input className="input" name="real_name" required />
        </div>
        <div className="field">
          <label className="label">Alias</label>
          <input className="input" name="alias" />
        </div>
        <div className="field">
          <label className="label">Monthly target ($)</label>
          <input className="input num" name="monthly_target" type="number" defaultValue={0} />
        </div>
      </div>
      <SubmitButton>Add dispatcher</SubmitButton>
    </form>
  );
}
