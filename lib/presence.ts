// Derive a human presence state from the heartbeat timestamps. Nothing is
// stored as "online/offline" — we compute it from last_seen_at (any ping)
// and last_active_at (last real interaction) relative to now.

export type Presence = "online" | "idle" | "offline";

const OFFLINE_AFTER_MS = 150_000; // ~2.5 min without a heartbeat => offline
const IDLE_AFTER_MS = 5 * 60_000; // seen recently but no interaction => idle

export function derivePresence(
  lastSeenAt: string | null,
  lastActiveAt: string | null,
  now: number = Date.now()
): Presence {
  if (!lastSeenAt) return "offline";
  const seenAge = now - new Date(lastSeenAt).getTime();
  if (seenAge > OFFLINE_AFTER_MS) return "offline";
  const activeAge = lastActiveAt ? now - new Date(lastActiveAt).getTime() : Infinity;
  if (activeAge > IDLE_AFTER_MS) return "idle";
  return "online";
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  idle: "Idle",
  offline: "Offline",
};

// "5 min ago" / "just now" / "3 hr ago" / "2 days ago" — compact relative time.
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} mo ago`;
}
