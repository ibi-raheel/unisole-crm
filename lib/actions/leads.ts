"use server";

import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { FormState, fnum } from "./_util";

// Normalise a header/name for fuzzy matching.
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

// Column aliases → carrier field. First match wins.
const COLUMN_ALIASES: Record<string, string[]> = {
  company_name: ["company", "company name", "carrier", "carrier name", "name", "business"],
  contact_person: ["contact", "contact person", "contact name", "owner", "person"],
  phone: ["phone", "phone number", "mobile", "cell", "number", "contact number"],
  email: ["email", "e-mail", "mail"],
  mc_number: ["mc", "mc number", "mc#", "mc no", "mc no.", "motor carrier"],
  mc_age: ["mc age", "age", "authority age"],
  lead_source: ["lead source", "source", "origin"],
  agent: ["agent", "sales agent", "sales agent name", "assigned agent", "rep"],
};

// Build a lookup from a row object (header→value) with normalised keys.
function fieldGetter(row: Record<string, unknown>) {
  const byNorm: Record<string, unknown> = {};
  for (const k of Object.keys(row)) byNorm[norm(k)] = row[k];
  return (field: string): string | null => {
    for (const alias of COLUMN_ALIASES[field] ?? []) {
      const v = byNorm[alias];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return null;
  };
}

export async function importLeads(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "sales_head")) {
    return { error: "Only an admin or sales head can import leads." };
  }

  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please choose a file." };
  const defaultAgentId = fnum(fd, "default_agent_id");

  // Parse the sheet (xlsx or csv) server-side.
  let rows: Record<string, unknown>[];
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { error: "The file has no sheets." };
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
  } catch {
    return { error: "Couldn't read that file. Use .xlsx or .csv." };
  }
  if (rows.length === 0) return { error: "The sheet is empty." };

  const supabase = await createClient();

  // Map sales-agent names/aliases → id so a per-row "Agent" column can be used.
  const { data: agents } = await supabase
    .from("sales_agents")
    .select("id, real_name, alias")
    .eq("is_active", true);
  const agentByName = new Map<string, number>();
  for (const a of (agents ?? []) as { id: number; real_name: string; alias: string | null }[]) {
    agentByName.set(norm(a.real_name), a.id);
    if (a.alias) agentByName.set(norm(a.alias), a.id);
  }

  const toInsert: Record<string, unknown>[] = [];
  let skippedNoName = 0;
  let skippedNoAgent = 0;

  for (const row of rows) {
    const get = fieldGetter(row);
    const company = get("company_name");
    if (!company) {
      skippedNoName++;
      continue;
    }
    const agentName = get("agent");
    const agentId =
      (agentName && agentByName.get(norm(agentName))) || defaultAgentId || null;
    if (!agentId) {
      skippedNoAgent++;
      continue;
    }
    toInsert.push({
      company_name: company,
      contact_person: get("contact_person"),
      phone: get("phone"),
      email: get("email"),
      mc_number: get("mc_number"),
      mc_age: get("mc_age"),
      lead_source: get("lead_source") ?? "Excel import",
      sales_agent_id: agentId,
      status: "Lead",
      created_by: profile.id,
    });
  }

  if (toInsert.length === 0) {
    return {
      error:
        skippedNoAgent > 0
          ? "No rows had an agent. Add an 'Agent' column or pick a default agent below."
          : "No valid rows found (every row needs a company name).",
    };
  }

  const { error, count } = await supabase
    .from("carriers")
    .insert(toInsert, { count: "exact" });
  if (error) return { error: error.message };

  revalidatePath("/carriers");
  const bits = [`Imported ${count ?? toInsert.length} lead${(count ?? 0) === 1 ? "" : "s"}.`];
  if (skippedNoName) bits.push(`${skippedNoName} skipped (no company name).`);
  if (skippedNoAgent) bits.push(`${skippedNoAgent} skipped (no agent).`);
  return { ok: true, message: bits.join(" ") };
}
