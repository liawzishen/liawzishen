import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, isPlanId, type PlanId } from "./plans";

/**
 * Scan allowance for a user. Usage is DERIVED: a count of ai_scan_usage rows
 * in the current UTC calendar month — nothing to reset, no cron. Consumption
 * order is monthly allowance first, then purchased bonus scans, so
 * `remaining = max(0, limit - used) + bonus` (null = unlimited).
 *
 * If migration 0005 has not been applied yet, this degrades to a permissive
 * allowance (no enforcement) with `degraded: true` instead of crashing every
 * scan/profile page — the smoke test tells the user to run the migration.
 */
export type ScanAllowance = {
  plan: PlanId;
  planName: string;
  limit: number | null;
  used: number;
  bonus: number;
  remaining: number | null;
  resetsOn: string;
  degraded?: boolean;
};

export function monthStartISO(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
}

export function nextMonthStartISO(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  ).toISOString();
}

let warnedDegraded = false;

export async function getScanAllowance(
  supabase: SupabaseClient,
  userId: string
): Promise<ScanAllowance> {
  const [profileRes, usageRes] = await Promise.all([
    supabase.from("profiles").select("plan, bonus_scans").eq("id", userId).single(),
    supabase
      .from("ai_scan_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStartISO()),
  ]);

  if (profileRes.error || usageRes.error) {
    if (!warnedDegraded) {
      warnedDegraded = true;
      console.warn(
        "⚠ GreenMap billing degraded — run supabase/migrations/0005_billing.sql " +
          "in the Supabase SQL editor. Scans are NOT being limited until then. " +
          `(${(profileRes.error ?? usageRes.error)?.message})`
      );
    }
    return {
      plan: "percuma",
      planName: PLANS.percuma.name,
      limit: null,
      used: 0,
      bonus: 0,
      remaining: null,
      resetsOn: nextMonthStartISO(),
      degraded: true,
    };
  }

  const plan: PlanId = isPlanId(profileRes.data?.plan) ? profileRes.data.plan : "percuma";
  const bonus = Math.max(0, profileRes.data?.bonus_scans ?? 0);
  const used = usageRes.count ?? 0;
  const limit = PLANS[plan].scansPerMonth;

  return {
    plan,
    planName: PLANS[plan].name,
    limit,
    used,
    bonus,
    remaining: limit === null ? null : Math.max(0, limit - used) + bonus,
    resetsOn: nextMonthStartISO(),
  };
}
