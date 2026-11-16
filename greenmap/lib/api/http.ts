import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Small helpers shared by every route handler in app/api, so all routes
 * authenticate, parse bodies and report errors the same way.
 *
 * Routes do not call these one by one: `guardRequest()` (./guard.ts) runs the
 * checks in the right order. New routes should start with it.
 */

/** JSON error response: `{ error, ...extra }` with the given status. */
export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export const unauthorized = () => jsonError("Not authenticated", 401);
export const invalidJson = () => jsonError("Invalid JSON body", 400);
export const crossSite = () => jsonError("Cross-site requests are not allowed", 403);

/** 429 with a `Retry-After` header, so clients know when to try again. */
export function tooManyRequests(retryAfterSeconds: number) {
  const response = jsonError(
    "Too many requests. Please wait a moment and try again.",
    429,
    { code: "rate_limited", retryAfter: retryAfterSeconds }
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/**
 * Log the real cause on the server and send the client a safe message.
 * Database and upstream error text can reveal table names and internals, so
 * it must never be sent to the browser.
 */
export function serverError(scope: string, cause: unknown, publicMessage: string) {
  console.error(`[${scope}]`, cause);
  return jsonError(publicMessage, 500);
}

/** RLS-scoped Supabase client plus the signed-in user (null when signed out). */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * True when a browser on ANOTHER site sent this request.
 *
 * The session cookie already stays home on cross-site POSTs (SameSite=Lax),
 * so this is a second lock: an API call that changes data is only accepted
 * from the app's own pages. Browsers state where a request comes from in
 * `Sec-Fetch-Site`; older ones send `Origin`. A request with neither is not
 * from a browser page (curl, a server) and carries no ambient cookie risk.
 */
export function isCrossSiteRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";

  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    return (
      originHost !== req.headers.get("host") &&
      originHost !== req.headers.get("x-forwarded-host")
    );
  } catch {
    return true; // "null" or malformed origin
  }
}

/** Largest JSON body a route accepts unless it asks for another size. */
export const DEFAULT_MAX_BODY_BYTES = 100_000;

/**
 * Parse a JSON object body. Returns null for invalid JSON, a non-object, or a
 * body larger than `maxBytes` (a huge body would otherwise be read into
 * memory before any check could look at it).
 */
export async function readJsonObject(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return null;
  try {
    const text = await req.text();
    // Characters, not bytes — close enough for a size guard (a character is
    // at most four bytes), and it avoids encoding the body a second time.
    if (text.length > maxBytes) return null;
    const body: unknown = JSON.parse(text);
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Pure helpers for reading request fields live in ./parse (no server
// imports, so validators and forms can use them too). Re-exported here
// because routes have always imported them from this module.
export { cleanIdList, cleanText, isUuid } from "./parse";
