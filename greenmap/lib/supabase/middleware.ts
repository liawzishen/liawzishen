import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { userFromClaims, type AuthUser } from "@/lib/auth/claims";

// Rate-limits the "Supabase unreachable" warning to one line per minute —
// without it, auth-js's retry storm buries the real cause in stack traces.
let lastUnreachableWarn = 0;

/**
 * Refreshes the Supabase auth session on every request and returns
 * the (possibly updated) response plus the current user.
 * Standard @supabase/ssr middleware pattern.
 *
 * The user comes from `auth.getClaims()`: it renews an expiring session and
 * VERIFIES the login token. With asymmetric JWT signing keys the check is
 * local (no network call), so page views and link prefetches no longer each
 * cost a round trip to Supabase Auth. Projects on the legacy JWT secret fall
 * back to asking the Auth server, exactly like `getUser()` did.
 *
 * Trade-off (the standard one for signed tokens): a session that was signed
 * out on ANOTHER device stays usable here until its token expires (about an
 * hour at most). The database already worked that way — it accepts the same
 * token under RLS.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ supabaseResponse: NextResponse; user: AuthUser | null }> {
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

  // IMPORTANT: do not run code between createServerClient and getClaims() —
  // it can cause hard-to-debug session refresh issues.
  let user: AuthUser | null = null;
  let error: { status?: number } | null = null;
  try {
    const result = await supabase.auth.getClaims();
    error = result.error;
    user = result.error ? null : userFromClaims(result.data?.claims);
  } catch (e) {
    // getClaims only throws for non-auth failures. Never take the whole site
    // down from the middleware: treat the visitor as signed out.
    console.error("[middleware] could not verify the session:", e);
  }

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
