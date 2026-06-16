import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — BYPASSES Row Level Security.
 *
 * Server-only. Used from Phase 2/5 onward by:
 *   - scripts/seed-demo.ts
 *   - /api/health/recalculate, /api/ai/save-scan, /api/passports/generate
 *   - the public /passport/[qrToken] page (fetch by token)
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
