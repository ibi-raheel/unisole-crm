import { markMilestone } from "@/lib/actions/carriers";

// Contextual one-click buttons for the common sales milestones. Each sets the
// status and stamps today's date together (server component — no JS shipped).
export function MilestoneButtons({
  carrierId,
  status,
}: {
  carrierId: number;
  status: string;
}) {
  const Btn = ({ milestone, label }: { milestone: string; label: string }) => (
    <form action={markMilestone}>
      <input type="hidden" name="carrier_id" value={carrierId} />
      <input type="hidden" name="milestone" value={milestone} />
      <button className="btn" type="submit">
        {label}
      </button>
    </form>
  );

  const preSigning = ["Lead", "Documents Sent", "Documents Received"].includes(
    status
  );
  const isLive = !["Active", "Dead", "No Agreement"].includes(status);

  return (
    <div className="pill-row">
      {status === "Lead" && <Btn milestone="docs_sent" label="Mark documents sent" />}
      {status === "Documents Sent" && (
        <Btn milestone="docs_received" label="Mark documents received" />
      )}
      {preSigning && <Btn milestone="no_agreement" label="No agreement" />}
      {isLive && <Btn milestone="dead" label="Mark as dead" />}
    </div>
  );
}
