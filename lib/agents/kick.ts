// After a person changes a carrier, nudge the agents right away (after the
// response is sent), so "Documents Sent" starts the onboarding within
// seconds instead of waiting for the next cron. Silent if the service key
// isn't configured; never breaks the page that called it.
import { after } from "next/server";
import { supabaseStore } from "./supabaseStore";
import { makeProviders } from "./providers";
import { tick } from "./engine";

export function kickAgents() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  after(async () => {
    try { await tick(supabaseStore(), makeProviders(), { limit: 10 }); }
    catch (e) { console.error("[agents] kick failed:", e); }
  });
}
