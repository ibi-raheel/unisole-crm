// Carrier status helpers — labels, badge styling, and lifecycle ordering.
// Keep the em dash in "Signed — Awaiting First Load" exact (matches the DB enum).

export const CARRIER_STATUSES = [
  "Lead",
  "Documents Sent",
  "Documents Received",
  "Signed — Awaiting First Load",
  "Active",
  "No Agreement",
  "Dead",
] as const;

export type CarrierStatus = (typeof CARRIER_STATUSES)[number];

// Statuses a human may set by hand. "Signed — Awaiting First Load" and
// "Active" are deliberately excluded — the system sets those automatically
// (assign a dispatcher / deliver a load).
export const MANUAL_STATUSES: CarrierStatus[] = [
  "Lead",
  "Documents Sent",
  "Documents Received",
  "No Agreement",
  "Dead",
];

// The linear pipeline shown in the lifecycle strip (exits handled separately).
export const LIFECYCLE: CarrierStatus[] = [
  "Lead",
  "Documents Sent",
  "Documents Received",
  "Signed — Awaiting First Load",
  "Active",
];

const BADGE: Record<string, string> = {
  Lead: "badge badge-lead",
  "Documents Sent": "badge badge-sent",
  "Documents Received": "badge badge-received",
  "Signed — Awaiting First Load": "badge badge-awaiting",
  Active: "badge badge-active",
  "No Agreement": "badge badge-noagree",
  Dead: "badge badge-dead",
};

const SHORT: Record<string, string> = {
  "Signed — Awaiting First Load": "Awaiting load",
  "Documents Sent": "Docs sent",
  "Documents Received": "Docs received",
  "No Agreement": "No agreement",
};

export function badgeClass(status: string): string {
  return BADGE[status] ?? "badge badge-lead";
}

// Compact label for dense tables; full label everywhere else.
export function shortLabel(status: string): string {
  return SHORT[status] ?? status;
}
