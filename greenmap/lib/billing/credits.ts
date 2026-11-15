import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanAllowance } from "./usage";

/*
 * Spending scan credits safely.
 *
 * The old flow was "read the balance → run the scan → write the usage".
 * Requests sent at the same moment all read the same balance, so one credit
 * could pay for many scans. Now a credit is RESERVED before the scan (one
 * atomic database step, migration 0010) and RELEASED if the scan fails, so a
 * failed scan still costs nothing.
 *
 * Until 0010 is applied the database has no reserve step; the code then
 * keeps the old behaviour ("legacy") instead of breaking scans.
 */

export type ScanReservation =
  /** A credit is held. `remaining` is the balance after this scan. */
  | { kind: "reserved"; usageId: string; fromBonus: boolean; remaining: number | null }
  /** The balance is empty (another request used the last credit). */
  | { kind: "denied" }
  /** 0010 not applied: usage is written after a successful scan, as before. */
  | { kind: "legacy" }
  /** Billing tables are missing (0005 not applied): nothing to count. */
  | { kind: "untracked" };

/** PostgREST: "no function with this name" — the migration is not applied. */
const FUNCTION_MISSING = new Set(["PGRST202", "42883"]);

export function scansLeftAfter(allowance: ScanAllowance): number | null {
  return allowance.remaining === null ? null : Math.max(0, allowance.remaining - 1);
}

/** Hold one scan credit for `userId` before doing the expensive work. */
export async function reserveScanCredit(
  userId: string,
  allowance: ScanAllowance
): Promise<ScanReservation> {
  if (allowance.degraded) return { kind: "untracked" };
  try {
    const { data, error } = await createAdminClient().rpc("consume_scan_credit", {
      p_user: userId,
      p_monthly_limit: allowance.limit,
    });
    if (error) {
      if (!FUNCTION_MISSING.has(error.code ?? "")) {
        console.error("[billing] could not reserve a scan credit:", error);
      }
      return { kind: "legacy" };
    }
    const reply = data as {
      ok?: boolean;
      usage_id?: string;
      from_bonus?: boolean;
      remaining?: number | null;
    } | null;
    if (!reply?.ok || !reply.usage_id) return { kind: "denied" };
    return {
      kind: "reserved",
      usageId: reply.usage_id,
      fromBonus: reply.from_bonus === true,
      remaining: reply.remaining ?? null,
    };
  } catch (cause) {
    // No service-role key: accounting is impossible either way.
    console.error("[billing] could not reserve a scan credit:", cause);
    return { kind: "legacy" };
  }
}

/**
 * Finish a reservation once the scan is over. Accounting must never break a
 * scan that already succeeded, so errors are logged, not thrown.
 */
export async function settleScanCredit(
  userId: string,
  allowance: ScanAllowance,
  reservation: ScanReservation,
  succeeded: boolean
): Promise<void> {
  try {
    if (reservation.kind === "reserved" && !succeeded) {
      const { error } = await createAdminClient().rpc("release_scan_credit", {
        p_user: userId,
        p_usage_id: reservation.usageId,
        p_from_bonus: reservation.fromBonus,
      });
      if (error) throw error;
    }
    if (reservation.kind === "legacy" && succeeded) {
      await recordUsageLegacy(userId, allowance);
    }
  } catch (cause) {
    console.error("[billing] scan credit accounting failed:", cause);
  }
}

/** The balance to show after the scan. */
export function scansLeft(
  allowance: ScanAllowance,
  reservation: ScanReservation,
  succeeded: boolean
): number | null {
  if (!succeeded) return allowance.remaining;
  return reservation.kind === "reserved" ? reservation.remaining : scansLeftAfter(allowance);
}

/** Pre-0010 accounting: one usage row, and one bonus scan if the month is used up. */
async function recordUsageLegacy(userId: string, allowance: ScanAllowance) {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_scan_usage").insert({ user_id: userId });
  if (error) throw error;
  if (allowance.limit !== null && allowance.used >= allowance.limit && allowance.bonus > 0) {
    await admin
      .from("profiles")
      .update({ bonus_scans: allowance.bonus - 1 })
      .eq("id", userId);
  }
}

/**
 * Add purchased scans to `userId` and return the new balance.
 * One statement in the database (0010) — two payments finishing together can
 * no longer overwrite each other. Falls back to read-then-write before 0010.
 */
export async function addBonusScans(userId: string, qty: number): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("add_bonus_scans", { p_user: userId, p_qty: qty });
  if (!error) {
    if (typeof data !== "number") throw new Error("profile not found");
    return data;
  }
  if (!FUNCTION_MISSING.has(error.code ?? "")) throw error;

  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("bonus_scans")
    .eq("id", userId)
    .single();
  if (readError) throw readError;
  const balance = Math.max(0, profile?.bonus_scans ?? 0) + qty;
  const { error: writeError } = await admin
    .from("profiles")
    .update({ bonus_scans: balance })
    .eq("id", userId);
  if (writeError) throw writeError;
  return balance;
}
