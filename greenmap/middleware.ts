import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import type { AppUserMetadata } from "@/types";

/**
 * Route protection (Phase 1):
 *   - /farms/** and /consumer require a session → otherwise redirect to /auth
 *   - logged-in users visiting /auth are redirected by role
 *   - /, /auth and /passport/** stay public
 */
export async function middleware(request: NextRequest) {
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
    return redirectResponse;
  };

  if (!user && isProtected) {
    return redirectTo("/auth");
  }

  if (user && path === "/auth") {
    const role = (user.user_metadata as AppUserMetadata | undefined)?.role;
    return redirectTo(role === "consumer" ? "/consumer" : "/farms");
  }

  return supabaseResponse;
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
