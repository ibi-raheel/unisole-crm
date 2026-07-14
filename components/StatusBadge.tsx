import { badgeClass, shortLabel } from "@/lib/status";

export function StatusBadge({
  status,
  short = false,
}: {
  status: string;
  short?: boolean;
}) {
  // Text label is always present (never colour alone — accessibility §9).
  return <span className={badgeClass(status)}>{short ? shortLabel(status) : status}</span>;
}
