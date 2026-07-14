import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for use in Server Components, Server Actions, and Route
// Handlers. It reads the logged-in user from the request cookies, so every
// query runs as that user — which is what makes the database's row-level
// security apply automatically.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; the session is
            // refreshed by middleware instead.
          }
        },
      },
    }
  );
}
