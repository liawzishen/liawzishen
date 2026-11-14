/**
 * The signed-in user, as read from the verified login token (JWT claims).
 *
 * Pure helpers with no imports, so the middleware (Edge runtime), server
 * components and unit tests can all share them.
 */

/** The parts of the user that pages need. */
export interface AuthUser {
  id: string;
  email: string | null;
  /** `user_metadata` from sign-up / profile edits (name, role, avatar_url…). */
  metadata: Record<string, unknown>;
}

/**
 * Build an {@link AuthUser} from verified JWT claims.
 * Returns null for anything that is not a real signed-in user — a missing
 * `sub`, or the `anon` / `service_role` API keys (which are JWTs too).
 */
export function userFromClaims(claims: unknown): AuthUser | null {
  if (!claims || typeof claims !== "object") return null;
  const c = claims as Record<string, unknown>;

  if (typeof c.sub !== "string" || !c.sub) return null;
  if (c.role !== "authenticated") return null;

  const metadata =
    c.user_metadata && typeof c.user_metadata === "object"
      ? (c.user_metadata as Record<string, unknown>)
      : {};

  return {
    id: c.sub,
    email: typeof c.email === "string" && c.email ? c.email : null,
    metadata,
  };
}

/** The user's display name, or `fallback` when none is set. */
export function displayName(user: AuthUser | null, fallback: string): string {
  const name = user?.metadata.name;
  return typeof name === "string" && name.trim() ? name.trim() : fallback;
}
