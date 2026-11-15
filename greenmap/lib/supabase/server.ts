import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client (anon key, RLS enforced) for Server Components,
 * Route Handlers and Server Actions. Reads the session from cookies.
 *
 * Wrapped in React `cache()`: one page render used to build three or four
 * clients (the page, its data helpers, the layout), each parsing the session
 * cookie again. Now every caller in the same request shares one client.
 * Outside a render (route handlers) `cache()` simply runs the function.
 */
export const createClient = cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore because the
          // middleware refreshes sessions on every request.
        }
      },
    },
  });
});

/** The server client's type, for data loaders that take the client as input. */
export type ServerClient = Awaited<ReturnType<typeof createClient>>;
