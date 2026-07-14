"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logDispatchNote } from "@/lib/actions/interactions";
import type { FormState } from "@/lib/actions/_util";
import { SubmitButton } from "./SubmitButton";

export function DispatchNoteModal({ carrierId }: { carrierId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(
    logDispatchNote,
    {}
  );
  const [note, setNote] = useState("");
  const router = useRouter();
  const draftKey = `unisole-dispatchnote-draft-${carrierId}`;

  useEffect(() => {
    if (open) setNote(localStorage.getItem(draftKey) ?? "");
  }, [open, draftKey]);
  useEffect(() => {
    if (open) localStorage.setItem(draftKey, note);
  }, [note, open, draftKey]);
  useEffect(() => {
    if (state.ok) {
      localStorage.removeItem(draftKey);
      setOpen(false);
      setNote("");
      router.refresh();
    }
  }, [state.ok, draftKey, router]);

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        Log dispatch note
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>Log a dispatch note</h2>
            {state.error ? <div className="error-box">{state.error}</div> : null}
            <form action={action}>
              <input type="hidden" name="carrier_id" value={carrierId} />
              <div className="field">
                <label className="label" htmlFor="dn_outcome">
                  Outcome
                </label>
                <select className="input" id="dn_outcome" name="outcome" defaultValue="">
                  <option value="">—</option>
                  <option>Load booked</option>
                  <option>Carrier unresponsive</option>
                  <option>Rate too low / declined</option>
                  <option>No suitable loads</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="dn_note">
                  Note
                </label>
                <textarea
                  className="input"
                  id="dn_note"
                  name="note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="dn_next">
                  Next action date
                </label>
                <input className="input" id="dn_next" name="next_action_date" type="date" />
              </div>
              <div className="pill-row">
                <SubmitButton>Save note</SubmitButton>
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
