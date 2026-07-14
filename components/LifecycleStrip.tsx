import { LIFECYCLE, CarrierStatus } from "@/lib/status";

// The signature element (Design §6.2): the sale's journey at a glance.
// Pure divs + borders — no images, no JavaScript.
export function LifecycleStrip({
  status,
  statusChangedAt,
}: {
  status: string;
  statusChangedAt?: string | null;
}) {
  const isExit = status === "Dead" || status === "No Agreement";
  const currentIndex = LIFECYCLE.indexOf(status as CarrierStatus);

  const daysInStage =
    statusChangedAt != null
      ? Math.floor(
          (Date.now() - new Date(statusChangedAt).getTime()) / 86_400_000
        )
      : null;

  return (
    <div>
      <div className="lifecycle">
        {LIFECYCLE.map((stage, i) => {
          let state: "done" | "current" | "future" = "future";
          if (currentIndex >= 0) {
            state = i < currentIndex ? "done" : i === currentIndex ? "current" : "future";
          } else if (isExit) {
            // Exited: everything up to where it left is treated as past.
            state = "future";
          }
          return (
            <div key={stage} className={`ls-step ls-${state}`}>
              <div className="ls-dot" />
              <div className="ls-label">{stage}</div>
              {state === "current" && daysInStage != null ? (
                <div className="ls-date num">{daysInStage}d</div>
              ) : null}
            </div>
          );
        })}
      </div>
      {isExit ? (
        <div style={{ marginTop: 8 }}>
          <span className={status === "Dead" ? "badge badge-dead" : "badge badge-noagree"}>
            {status}
          </span>
          {daysInStage != null ? (
            <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
              {daysInStage} days ago
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
