import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — BYPASSES Row Level Security.
 *
 * Server-only. It is the ONLY way to write the data a grower must not be
 * able to write for themselves (migration 0010): health scores, AI analyses,
 * passports, billing, stock, the assistant's chat replies. So every use must
 * come AFTER a check that the signed-in user may do this — see the API
 * routes, which all start with guardRequest() and then check ownership.
 *
 * Used by the API routes, the public passport loader (lib/passport/queries.ts)
 * and the seed scripts. Never import this from a Client Component, and never
 * from a page: pages read through the loaders in lib/.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never run in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (server-only). Add it to .env.local — required from Phase 2 onward."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
