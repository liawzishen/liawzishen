import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — BYPASSES Row Level Security.
 *
 * Server-only. Used from Phase 2/5 onward by:
 *   - the seed scripts in scripts/
 *   - /api/health/recalculate, /api/ai/scan, /api/ai/save-scan,
 *     /api/passports/generate, /api/tasks/*, /api/payments,
 *     /api/support/chat (seller auto-reply + AI answer rows)
 *   - the public /passport/[qrToken] page (fetch by token)
 *
 * Since migration 0010 it is the ONLY way to write calculated trust data
 * (health scores, AI analyses, score history, passports).
 *
 * Never import this from a Client Component.
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
