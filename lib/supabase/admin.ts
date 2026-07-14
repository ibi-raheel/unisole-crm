import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key. This bypasses
// row-level security and can manage Auth users, so it must NEVER be imported
// into a Client Component or exposed to the browser. Used only inside
// admin-guarded server actions (e.g. creating team logins).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
