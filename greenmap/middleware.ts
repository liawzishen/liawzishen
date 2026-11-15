import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp, createNonce } from "@/lib/security/csp";

/**
 * Runs before every page:
 *
 * 1. Content-Security-Policy (lib/security/csp.ts) with a fresh one-time
 *    nonce. The policy is put on the REQUEST too: Next reads it there while
 *    rendering and stamps the nonce on its own <script> tags.
 * 2. Route protection:
 *   - /farms/** and /consumer require a session → otherwise redirect to /auth
 *   - logged-in users visiting /auth are redirected by role
 *   - /, /auth and /passport/** stay public
 */
export async function middleware(request: NextRequest) {
  const csp = buildCsp({
    nonce: createNonce(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
  });
  // Set before updateSession(): it forwards these request headers to the page.
  request.headers.set("Content-Security-Policy", csp);
  const withCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isProtected =
    path.startsWith("/farms") || path.startsWith("/consumer");

  // Build a redirect that keeps any refreshed auth cookies.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie));
    return withCsp(redirectResponse);
  };

  if (!user && isProtected) {
    return redirectTo("/auth");
  }

  if (user && path === "/auth") {
    return redirectTo(user.metadata.role === "consumer" ? "/consumer" : "/farms");
  }

  return withCsp(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Run on every page, but skip:
     *  - /api/** — every route handler authenticates itself (getUser + RLS),
     *    so running the middleware there would just pay the Supabase session
     *    round trip twice per API call
     *  - Next internals and static assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
