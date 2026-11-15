import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Rate limits for the API routes: "at most `max` requests per person in
 * `windowSeconds`".
 *
 * Two counters work together:
 *
 *   - MEMORY: free and instant, but each server instance has its own, so on
 *     a host that runs many instances it only catches the simplest floods.
 *   - SHARED: one counter in the database (migration 0010,
 *     `take_rate_limit`), correct across all instances. It costs one small
 *     round trip, so only the routes that cost real money per call use it.
 *
 * The memory counter always runs first — a request it refuses never reaches
 * the database. If the shared counter is not installed yet (0010 not applied)
 * the memory counter is used alone and a warning is logged once.
 */

export interface RateLimitRule {
  /** Short name; part of the counter key. */
  name: string;
  max: number;
  windowSeconds: number;
  /** Also count in the database, across all server instances. */
  shared: boolean;
}

/** The limits, per signed-in person. Generous for people, tight for scripts. */
export const LIMITS = {
  /** AI photo scan. Also bounded by scan credits. */
  scan: { name: "scan", max: 10, windowSeconds: 600, shared: true },
  /** AI care tip (one per plant page; the browser caches it for an hour). */
  suggest: { name: "suggest", max: 40, windowSeconds: 600, shared: true },
  /** Support chat message (each one is an AI call). */
  chat: { name: "chat", max: 20, windowSeconds: 300, shared: true },
  /** Satellite search (map service quota + one stored image per call). */
  satellite: { name: "satellite", max: 10, windowSeconds: 600, shared: true },
  payment: { name: "payment", max: 10, windowSeconds: 60, shared: true },
  /** Everyday writes: tick a task, log care, save a scan. Memory only. */
  write: { name: "write", max: 120, windowSeconds: 60, shared: false },
} as const satisfies Record<string, RateLimitRule>;

interface Counter {
  windowStart: number;
  count: number;
}

/** Above this many counters, expired ones are swept out. */
const SWEEP_AT = 5_000;

/**
 * A fixed-window counter in memory. `take` returns 0 when the request is
 * allowed, otherwise the seconds to wait. The clock is injectable for tests.
 */
export function createMemoryLimiter(now: () => number = Date.now) {
  const counters = new Map<string, Counter>();

  function sweep(time: number) {
    for (const [key, counter] of counters) {
      // Windows differ per rule; an hour covers the longest one many times.
      if (time - counter.windowStart > 3_600_000) counters.delete(key);
    }
  }

  return {
    take(key: string, rule: RateLimitRule): number {
      const time = now();
      const windowMs = rule.windowSeconds * 1000;
      let counter = counters.get(key);
      if (!counter || time - counter.windowStart >= windowMs) {
        if (counters.size >= SWEEP_AT) sweep(time);
        counter = { windowStart: time, count: 0 };
        counters.set(key, counter);
      }
      counter.count += 1;
      if (counter.count <= rule.max) return 0;
      return Math.max(1, Math.ceil((counter.windowStart + windowMs - time) / 1000));
    },
    size: () => counters.size,
  };
}

const memory = createMemoryLimiter();

/** How long to stop asking the database after it could not answer. */
const SHARED_RETRY_MS = 5 * 60_000;
let sharedUnavailableUntil = 0;

/** The database counter. Null = could not be used (caller falls back). */
async function takeShared(key: string, rule: RateLimitRule): Promise<number | null> {
  if (Date.now() < sharedUnavailableUntil) return null;
  try {
    const { data, error } = await createAdminClient().rpc("take_rate_limit", {
      p_key: key,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) throw error;
    if (typeof data === "number") return data;
    throw new Error("unexpected reply from take_rate_limit");
  } catch (cause) {
    sharedUnavailableUntil = Date.now() + SHARED_RETRY_MS;
    console.warn(
      "⚠ GreenMap: shared rate limits are off (is migration 0010 applied and " +
        "SUPABASE_SERVICE_ROLE_KEY set?). Using per-instance limits only.",
      cause instanceof Error ? cause.message : cause
    );
    return null;
  }
}

/**
 * Count one request by `userId` against `rule`.
 * Returns 0 when it may proceed, otherwise the seconds to wait.
 */
export async function rateLimit(userId: string, rule: RateLimitRule): Promise<number> {
  const key = `${rule.name}:${userId}`;
  const wait = memory.take(key, rule);
  if (wait > 0 || !rule.shared) return wait;
  return (await takeShared(key, rule)) ?? 0;
}
