import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Small helpers shared by every route handler in app/api, so all routes
 * authenticate, parse bodies and report errors the same way.
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

/** Parse a JSON object body. Returns null for invalid JSON or a non-object. */
export async function readJsonObject(
  req: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * A trimmed, single-line string no longer than `max`, or "" when the value is
 * not a string. Use for short free-text fields that end up in prompts or rows.
 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Unique string ids from an unknown value, capped at `max` entries. */
export function cleanIdList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const v of value) {
    if (typeof v === "string" && v.length > 0 && v.length <= 64) ids.add(v);
    if (ids.size >= max) break;
  }
  return [...ids];
}
