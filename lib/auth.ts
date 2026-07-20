import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Role =
  | "sales_agent"
  | "dispatcher"
  | "sales_head"
  | "dispatch_head"
  | "admin"
  | "system";

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
  linked_agent_id: number | null;
  linked_dispatcher_id: number | null;
  is_active: boolean;
};

// Returns the logged-in user's profile, or null if not signed in / no profile.
//
// Wrapped in React cache() so it runs at most ONCE per request: the layout and
// the page both call requireProfile(), and without this that means two
// getUser() round-trips + two profiles queries per navigation. cache() dedupes
// them within a single server render (it never persists across requests, so
// row-level security still applies per user).
export const getProfile = cache(async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, role, linked_agent_id, linked_dispatcher_id, is_active")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
});

// Use at the top of any protected page. Guarantees a profile or redirects.
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}
