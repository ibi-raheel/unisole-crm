// =====================================================================
// UniSole agents — outside services (AI model, DocuSign, email, WhatsApp, calls)
// =====================================================================
// Each service switches itself on when its keys are present, and stays in
// PRACTICE MODE when they are not. Practice mode returns a fake reference
// ("practice-…") and sends nothing; the engine still records the message
// in agent_outbox, so a manager can read exactly what would have gone out.
//
// Keys (all optional — see README "AI agents"):
//   ANTHROPIC_API_KEY, AGENT_MODEL                       → drafting and review
//   DOCUSIGN_ACCESS_TOKEN, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_BASE_URL → e-signature
//   RESEND_API_KEY, AGENT_FROM_EMAIL                     → email
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID                    → WhatsApp Cloud API
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   → the hello call
// =====================================================================

import type { Mode, Providers, SendResult } from "./types.ts";

type Env = Record<string, string | undefined>;

let seq = 0;
const practice = (kind: string): SendResult => ({ ref: `practice-${kind}-${Date.now().toString(36)}-${++seq}`, status: "practice" });

async function postJSON(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export function makeProviders(env: Env = process.env, opts: { forcePractice?: boolean } = {}): Providers {
  const on = (...keys: string[]): Mode => (!opts.forcePractice && keys.every(k => !!env[k]) ? "live" : "practice");
  const mode = {
    llm: on("ANTHROPIC_API_KEY"),
    esign: on("DOCUSIGN_ACCESS_TOKEN", "DOCUSIGN_ACCOUNT_ID"),
    email: on("RESEND_API_KEY", "AGENT_FROM_EMAIL"),
    whatsapp: on("WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"),
    voice: on("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"),
  };

  return {
    mode,

    async llm(system, prompt) {
      if (mode.llm === "practice") return null;
      const out = await postJSON("https://api.anthropic.com/v1/messages",
        { "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        { model: env.AGENT_MODEL || "claude-sonnet-5-5", max_tokens: 800, system, messages: [{ role: "user", content: prompt }] });
      return (out.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim() || null;
    },

    async esign({ to, name, title, body }) {
      if (mode.esign === "practice") return practice("esign");
      const base = env.DOCUSIGN_BASE_URL || "https://demo.docusign.net";
      const out = await postJSON(`${base}/restapi/v2.1/accounts/${env.DOCUSIGN_ACCOUNT_ID}/envelopes`,
        { authorization: `Bearer ${env.DOCUSIGN_ACCESS_TOKEN}` },
        {
          emailSubject: title,
          documents: [{ documentId: "1", name: `${title}.txt`, fileExtension: "txt", documentBase64: Buffer.from(body).toString("base64") }],
          recipients: { signers: [{ email: to, name, recipientId: "1", routingOrder: "1",
            tabs: { signHereTabs: [{ anchorString: "Carrier signature:", anchorXOffset: "140", anchorYOffset: "0" }] } }] },
          status: "sent",
        });
      return { ref: out.envelopeId, status: "sent" };
    },

    async email(to, subject, body) {
      if (mode.email === "practice") return practice("email");
      const out = await postJSON("https://api.resend.com/emails", { authorization: `Bearer ${env.RESEND_API_KEY}` },
        { from: env.AGENT_FROM_EMAIL, to: [to], subject, text: body });
      return { ref: out.id, status: "sent" };
    },

    async whatsapp(to, body) {
      if (mode.whatsapp === "practice") return practice("wa");
      const out = await postJSON(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`,
        { authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
        { messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type: "text", text: { body } });
      return { ref: out.messages?.[0]?.id ?? "wa-sent", status: "sent" };
    },

    async call(to, script) {
      if (mode.voice === "practice") return practice("call");
      const sid = env.TWILIO_ACCOUNT_SID!;
      const twiml = `<Response><Say voice="Polly.Joanna">${script.replace(/[<&>]/g, " ")}</Say></Response>`;
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: "POST",
        headers: { authorization: "Basic " + Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: env.TWILIO_FROM!, Twiml: twiml }),
      });
      const out: any = await r.json();
      if (!r.ok) throw new Error(`twilio ${r.status}: ${out.message ?? ""}`);
      return { ref: out.sid, status: "sent" };
    },
  };
}
