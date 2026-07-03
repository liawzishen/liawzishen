import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rate-limits the "Supabase unreachable" warning to one line per minute —
// without it, auth-js's retry storm buries the real cause in stack traces.
let lastUnreachableWarn = 0;

/**
 * Refreshes the Supabase auth session on every request and returns
 * the (possibly updated) response plus the current user.
 * Standard @supabase/ssr middleware pattern.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Without env vars we cannot check auth — let the page-level clients
    // throw their (clearer) setup error instead of crashing the middleware.
    return { supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser() —
  // it can cause hard-to-debug session refresh issues.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // status 0 = Supabase itself was unreachable (DNS/network), not a bad
  // session. By far the most common cause: a paused free-tier project.
  if (error?.status === 0 && Date.now() - lastUnreachableWarn > 60_000) {
    lastUnreachableWarn = Date.now();
    console.warn(
      `⚠ GreenMap: Supabase unreachable at ${url} — no data can load. ` +
        `If this is a free-tier project it is probably PAUSED: restore it at ` +
        `https://supabase.com/dashboard, then run \`npm run test:smoke\` to verify.`
    );
  }

  return { supabaseResponse, user };
}
