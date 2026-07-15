"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Record the login (best-effort; never block sign-in on an audit write).
  try {
    const ua = (await headers()).get("user-agent");
    await supabase.rpc("log_auth_event", { p_kind: "login", p_user_agent: ua });
  } catch {
    /* audit is non-critical */
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  // Log the logout while still authenticated, then end the session.
  try {
    await supabase.rpc("log_auth_event", { p_kind: "logout" });
  } catch {
    /* audit is non-critical */
  }
  await supabase.auth.signOut();
  redirect("/login");
}
