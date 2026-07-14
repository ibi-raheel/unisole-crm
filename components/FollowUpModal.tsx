"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logFollowUp } from "@/lib/actions/interactions";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

export function FollowUpModal({ carrierId }: { carrierId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(logFollowUp, {});
  const [notes, setNotes] = useState("");
  const router = useRouter();
  const draftKey = `unisole-followup-draft-${carrierId}`;

  // Restore any saved draft when opening; autosave as they type.
  useEffect(() => {
    if (open) setNotes(localStorage.getItem(draftKey) ?? "");
  }, [open, draftKey]);
  useEffect(() => {
    if (open) localStorage.setItem(draftKey, notes);
  }, [notes, open, draftKey]);

  // On success: clear draft, close, refresh the page data.
  useEffect(() => {
    if (state.ok) {
      localStorage.removeItem(draftKey);
      setOpen(false);
      setNotes("");
      router.refresh();
    }
  }, [state.ok, draftKey, router]);

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        Log follow-up
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>Log a follow-up</h2>
            {state.error ? <div className="error-box">{state.error}</div> : null}
            <form action={action}>
              <input type="hidden" name="carrier_id" value={carrierId} />
              <div className="form-row">
                <div className="field">
                  <label className="label" htmlFor="fu_type">
                    Type
                  </label>
                  <select className="input" id="fu_type" name="type" defaultValue="Call">
                    <option>Call</option>
                    <option>Text</option>
                    <option>Email</option>
                    <option>In-person</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="fu_outcome">
                    Outcome
                  </label>
                  <select className="input" id="fu_outcome" name="outcome" defaultValue="">
                    <option value="">—</option>
                    <option>Interested</option>
                    <option>Not interested</option>
                    <option>Callback later</option>
                    <option>Signed</option>
                    <option>Went dead</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="fu_notes">
                  Notes
                </label>
                <textarea
                  className="input"
                  id="fu_notes"
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="fu_next">
                  Next follow-up date
                </label>
                <input className="input" id="fu_next" name="next_followup_date" type="date" />
              </div>
              <div className="pill-row">
                <SubmitButton>Save follow-up</SubmitButton>
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
