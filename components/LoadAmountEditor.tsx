"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { editLoadAmount } from "@/lib/actions/loads";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

// Admin-only: change a load's amount (rate) with a required reason.
export function LoadAmountEditor({
  loadId,
  currentRate,
}: {
  loadId: number;
  currentRate: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(editLoadAmount, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <>
      <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
        Edit $
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>Edit load amount</h2>
            {state.error ? <div className="error-box">{state.error}</div> : null}
            <form action={action}>
              <input type="hidden" name="load_id" value={loadId} />
              <div className="field">
                <label className="label" htmlFor="rate">New amount ($) *</label>
                <input
                  className="input num"
                  id="rate"
                  name="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={currentRate}
                  required
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="reason">Reason for the change *</label>
                <textarea
                  className="input"
                  id="reason"
                  name="reason"
                  rows={2}
                  required
                  placeholder="Why is the amount changing?"
                />
              </div>
              <div className="pill-row">
                <SubmitButton>Save amount</SubmitButton>
                <button className="btn" type="button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
