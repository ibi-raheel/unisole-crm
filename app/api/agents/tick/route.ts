// The agents' heartbeat. Vercel Cron calls this (see vercel.json) with
// "Authorization: Bearer $CRON_SECRET". ?daily=1 also queues the daily
// follow-ups and the manager summary.
import { NextResponse } from "next/server";
import { supabaseStore } from "@/lib/agents/supabaseStore";
import { makeProviders } from "@/lib/agents/providers";
import { daily, tick } from "@/lib/agents/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = supabaseStore();
  const providers = makeProviders();
  const queued = new URL(req.url).searchParams.get("daily") === "1" ? await daily(store) : 0;
  const ran = await tick(store, providers);
  return NextResponse.json({ queued, ran, mode: providers.mode });
}
