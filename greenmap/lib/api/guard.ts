import type { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { ServerClient } from "@/lib/supabase/server";
import {
  crossSite,
  getSessionUser,
  invalidJson,
  isCrossSiteRequest,
  readJsonObject,
  tooManyRequests,
  unauthorized,
} from "./http";
import { rateLimit, type RateLimitRule } from "./rate-limit";

/*
 * The front door of every API route.
 *
 * Each route used to repeat "who is this? is the body JSON?" by hand, and a
 * check that is written by hand in ten places is forgotten in the eleventh.
 * `guardRequest` runs the checks every route needs, in one fixed order:
 *
 *   1. The request comes from the app's own pages (not another website).
 *   2. Somebody is signed in.
 *   3. They are not sending requests faster than the route's limit.
 *   4. The body is a JSON object of a sane size.
 *
 * What a route does AFTER that — "is this plant yours?" — stays in the
 * route, because only the route knows what it is about to touch.
 */

export interface GuardOptions {
  /**
   * The route's rate limit. Null only when the route answers a limited
   * caller in its own way (see /api/ai/suggest).
   */
  limit: RateLimitRule | null;
  /** Largest accepted body, when the default does not fit. */
  maxBodyBytes?: number;
}

export type Guarded =
  | {
      ok: true;
      /** Row Level Security client: it can only see the caller's own rows. */
      supabase: ServerClient;
      user: User;
      body: Record<string, unknown>;
    }
  | { ok: false; response: NextResponse };

export async function guardRequest(req: Request, options: GuardOptions): Promise<Guarded> {
  if (isCrossSiteRequest(req)) return { ok: false, response: crossSite() };

  const { supabase, user } = await getSessionUser();
  if (!user) return { ok: false, response: unauthorized() };

  if (options.limit) {
    const wait = await rateLimit(user.id, options.limit);
    if (wait > 0) return { ok: false, response: tooManyRequests(wait) };
  }

  const body = await readJsonObject(req, options.maxBodyBytes);
  if (!body) return { ok: false, response: invalidJson() };

  return { ok: true, supabase, user, body };
}
