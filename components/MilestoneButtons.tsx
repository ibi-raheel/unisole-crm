"use client";

import { useActionState } from "react";
import { markMilestone } from "@/lib/actions/carriers";
import type { FormState } from "@/lib/actions/_util";

// Contextual one-click buttons for the common sales milestones. Each sets the
// status and stamps today's date together. For non-admins this files an
// approval request instead of changing the carrier directly.
export function MilestoneButtons({
  carrierId,
  status,
}: {
  carrierId: number;
  status: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(markMilestone, {});

  const preSigning = ["Lead", "Documents Sent", "Documents Received"].includes(status);
  const isLive = !["Active", "Dead", "No Agreement"].includes(status);

  return (
    <form action={action}>
      <input type="hidden" name="carrier_id" value={carrierId} />
      <div className="pill-row">
        {status === "Lead" && (
          <button className="btn" type="submit" name="milestone" value="docs_sent">
            Mark documents sent
          </button>
        )}
        {status === "Documents Sent" && (
          <button className="btn" type="submit" name="milestone" value="docs_received">
            Mark documents received
          </button>
        )}
        {preSigning && (
          <button className="btn" type="submit" name="milestone" value="no_agreement">
            No agreement
          </button>
        )}
        {isLive && (
          <button className="btn" type="submit" name="milestone" value="dead">
            Mark as dead
          </button>
        )}
        {state.message ? <span className="muted">{state.message}</span> : null}
        {state.ok && !state.message ? <span className="muted">Saved ✓</span> : null}
      </div>
      {state.error ? (
        <div className="error-box" style={{ marginTop: 8 }}>{state.error}</div>
      ) : null}
    </form>
  );
}
