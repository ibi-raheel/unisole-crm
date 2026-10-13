// DocuSign Connect webhook: when a carrier signs, the waiting onboarding
// run wakes up and carries on. Every call must carry DocuSign's HMAC
// signature (X-DocuSign-Signature-1), checked against DOCUSIGN_CONNECT_SECRET.
// In practice mode there is no webhook: use "Simulate signature" on /agents.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseStore } from "@/lib/agents/supabaseStore";
import { makeProviders } from "@/lib/agents/providers";
import { signatureReceived, tick } from "@/lib/agents/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key = process.env.DOCUSIGN_CONNECT_SECRET;
  if (!key) return NextResponse.json({ error: "DocuSign webhook not configured (practice mode)" }, { status: 503 });
  const raw = await req.text();
  const sig = Buffer.from(req.headers.get("x-docusign-signature-1") ?? "");
  const mac = Buffer.from(crypto.createHmac("sha256", key).update(raw).digest("base64"));
  if (sig.length !== mac.length || !crypto.timingSafeEqual(sig, mac))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const event = String(body.event ?? body.status ?? "");
  const envelopeId = body.data?.envelopeId ?? body.envelopeId;
  if (envelopeId && /completed/i.test(event)) {
    const store = supabaseStore();
    if (await signatureReceived(store, envelopeId)) await tick(store, makeProviders());
  }
  return NextResponse.json({ ok: true });
}
