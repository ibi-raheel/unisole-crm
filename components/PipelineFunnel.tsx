// Pipeline funnel: carriers at each lifecycle stage, drawn as proportional
// bars in lifecycle order. Reads the same numbers as carrier_pipeline_counts.

import { LIFECYCLE, type CarrierStatus } from "@/lib/status";

const BAR_CLASS: Record<string, string> = {
  Lead: "fn-lead",
  "Documents Sent": "fn-sent",
  "Documents Received": "fn-received",
  "Signed — Awaiting First Load": "fn-awaiting",
  Active: "fn-active",
};

export function PipelineFunnel({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...LIFECYCLE.map((s) => counts[s] ?? 0));
  const exited = (counts["No Agreement"] ?? 0) + (counts["Dead"] ?? 0);

  return (
    <div className="card">
      <div className="section-title">Sales pipeline</div>
      <div className="funnel">
        {LIFECYCLE.map((status: CarrierStatus) => {
          const n = counts[status] ?? 0;
          const pct = (n / max) * 100;
          return (
            <div key={status} className="fn-row">
              <div className="fn-label">{status}</div>
              <div className="fn-track">
                <div className={`fn-bar ${BAR_CLASS[status] ?? ""}`} style={{ width: `${Math.max(pct, n > 0 ? 6 : 0)}%` }}>
                  <span className="fn-n num">{n}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Exited pipeline: {exited} (No Agreement / Dead)
      </div>
    </div>
  );
}
