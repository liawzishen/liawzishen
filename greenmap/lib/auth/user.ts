import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { userFromClaims, type AuthUser } from "./claims";

export type { AuthUser } from "./claims";

/**
 * The signed-in user for Server Components — checked once per request.
 *
 * Uses `auth.getClaims()`, which VERIFIES the login token before trusting it:
 *   - Supabase projects with asymmetric JWT signing keys: the signature is
 *     checked locally with the project's public key. No network round trip.
 *   - Projects still on the legacy JWT secret: it asks the Auth server
 *     (one round trip, the same cost as `auth.getUser()`).
 *
 * `cache()` shares the result between the layout, the page and every
 * component of one request, so the check never runs twice.
 *
 * The claims are a snapshot from when the token was issued (it is renewed
 * about once an hour). That is fine for the id, email and display name.
 * Pages that must show the very latest account data (the Profile page) call
 * `supabase.auth.getUser()` instead, and route handlers that WRITE keep using
 * `getSessionUser()` in lib/api/http.ts.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return null;
    return userFromClaims(data.claims);
  } catch (e) {
    // Only non-auth failures land here (e.g. a broken runtime). Treat the
    // visitor as signed out rather than crash the page.
    console.error("[auth] could not verify the session:", e);
    return null;
  }
});
