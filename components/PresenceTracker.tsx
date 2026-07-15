"use client";

import { useEffect, useRef } from "react";

// Reports the signed-in user's presence to /api/presence. While the tab is
// visible it sends a heartbeat every BEAT_MS, flagging whether the user has
// interacted within IDLE_MS. On hide/close it fires a best-effort "away"
// beacon. Renders nothing.
const BEAT_MS = 45_000; // heartbeat cadence
const IDLE_MS = 5 * 60_000; // no interaction for this long => "idle"

export function PresenceTracker() {
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    const beat = () => {
      if (document.visibilityState !== "visible") return;
      const active = Date.now() - lastActivity.current < IDLE_MS;
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: active ? "active" : "idle" }),
        keepalive: true,
      }).catch(() => {});
    };

    beat(); // immediate ping on mount
    const iv = setInterval(beat, BEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onHide = () => {
      try {
        navigator.sendBeacon(
          "/api/presence",
          new Blob([JSON.stringify({ status: "away" })], { type: "application/json" })
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
