/*
 * Reading a request body field by field.
 *
 * A body arrives as `Record<string, unknown>` — nothing in it can be
 * trusted, not even its types. Each route has a `parse…` function that turns
 * it into a typed value or a message for the user. They are pure functions
 * (no database, no network), so every rule has a unit test.
 *
 * Nothing here imports server code, so the forms can share the same limits.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const valid = <T>(value: T): Parsed<T> => ({ ok: true, value });
export const invalid = (error: string): Parsed<never> => ({ ok: false, error });

/** True when `value` is one of `options` (narrows the type). */
export function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

/** A real calendar date written as YYYY-MM-DD ("2026-02-30" is not one). */
export function isDateISO(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** A finite number, or null. Strings such as "0.5" are NOT accepted. */
export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A trimmed, single-line string no longer than `max`, or "" when the value is
 * not a string. Use for short free-text fields that end up in prompts or rows.
 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a database id. Every id in this app is a UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Unique database ids from an unknown value, capped at `max` entries. */
export function cleanIdList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const v of value) {
    if (isUuid(v)) ids.add(v.toLowerCase());
    if (ids.size >= max) break;
  }
  return [...ids];
}
