import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/user";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";
import type { PaymentRow } from "@/lib/billing/payments";

/*
 * What the account pages read about the SIGNED-IN user: scan credits, plan
 * and payments, profile. Every loader answers null when nobody is signed in,
 * so the page decides what that means (redirect, or just hide a badge).
 */

/** The user's scan credits — the Scan tab's "x scans left" pill. */
export const getMyScanAllowance = cache(async (): Promise<ScanAllowance | null> => {
  const [supabase, user] = await Promise.all([createClient(), getAuthUser()]);
  return user ? getScanAllowance(supabase, user.id) : null;
});

export interface PlanOverview {
  allowance: ScanAllowance;
  /** The newest payments first. */
  payments: PaymentRow[];
}

/** Rows shown in the payment history. */
const PAYMENT_HISTORY_LIMIT = 20;

/** The My Plan page: current plan + usage, and the payment history. */
export const getPlanOverview = cache(async (): Promise<PlanOverview | null> => {
  const [supabase, user] = await Promise.all([createClient(), getAuthUser()]);
  if (!user) return null;

  const [allowance, payments] = await Promise.all([
    getScanAllowance(supabase, user.id),
    supabase
      .from("payments")
      .select("id, kind, amount_rm, method, created_at, meta")
      .order("created_at", { ascending: false })
      .limit(PAYMENT_HISTORY_LIMIT),
  ]);
  return { allowance, payments: (payments.data ?? []) as PaymentRow[] };
});

export interface AccountOverview {
  /** Straight from the Auth server — the newest account data. */
  user: User;
  /** The `profiles` row: mirrored name + the Verified Grower flag. */
  profile: { name: string; is_verified: boolean } | null;
  allowance: ScanAllowance;
}

/**
 * The Profile page. This is the one page that shows the NEWEST account data,
 * so it asks the Auth server for the user (the login token only holds a
 * snapshot from when it was issued). That call runs together with the two
 * profile queries.
 */
export const getAccountOverview = cache(async (): Promise<AccountOverview | null> => {
  const [supabase, authUser] = await Promise.all([createClient(), getAuthUser()]);
  if (!authUser) return null;

  const [
    {
      data: { user },
    },
    { data: profile },
    allowance,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("name, is_verified")
      .eq("id", authUser.id)
      .maybeSingle(),
    getScanAllowance(supabase, authUser.id),
  ]);
  if (!user) return null;

  return {
    user,
    profile: profile as { name: string; is_verified: boolean } | null,
    allowance,
  };
});
