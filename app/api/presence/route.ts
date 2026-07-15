import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Heartbeat endpoint. The client PresenceTracker POSTs here every ~45s while
// the app is open, and once more (via sendBeacon) when the tab is hidden or
// closed. Body: { status: "active" | "idle" | "away" }.
export async function POST(req: Request) {
  let status = "active";
  try {
    const body = await req.json();
    if (typeof body?.status === "string") status = body.status;
  } catch {
    /* empty / beacon body — default to active */
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // "active" = interacting now; "idle"/"away" still refresh last_seen so we
  // know they're around, but don't bump last_active_at.
  await supabase.rpc("touch_presence", { p_active: status === "active" });

  return NextResponse.json({ ok: true });
}
