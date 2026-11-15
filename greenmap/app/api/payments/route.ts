import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PLANS,
  PLAN_ORDER,
  isPlanId,
  TOPUP_PRICE_RM,
  TOPUP_MAX_QTY,
  BOOST_PACKAGES,
  isBoostPackageId,
  type PlanId,
} from "@/lib/billing/plans";
import { getListing } from "@/components/sales/demo-listings";
import { addBonusScans } from "@/lib/billing/credits";
import { guardRequest } from "@/lib/api/guard";
import { jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/payments";
const FAILED = "Payment could not be completed. Please try again.";

/**
 * POST /api/payments — the single place money "moves" (simulated).
 * The client says WHAT to buy, never the price: every amount is derived from
 * lib/billing/plans.ts. Effects are applied with the service-role client
 * because billing tables/columns are read-only for browsers (0005 RLS).
 * PRODUCTION SWAP POINT: replace the simulated success with a real gateway
 * call (Revenue Monster / Stripe Malaysia) and keep everything else.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.payment });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const method = body.method;
  if (method !== "fpx" && method !== "tng") {
    return jsonError("method must be 'fpx' or 'tng'", 400);
  }

  const admin = createAdminClient();
  const record = async (
    kind: "plan" | "topup" | "boost",
    amountRM: number,
    meta: Record<string, unknown>
  ) => {
    const { error } = await admin.from("payments").insert({
      user_id: user.id,
      kind,
      amount_rm: amountRM,
      method,
      status: "simulated",
      meta,
    });
    if (error) throw new Error(`payment record failed: ${error.message}`);
  };

  try {
    // ── plan change (upgrades charge; downgrades are free) ────────────────
    if (body.kind === "plan") {
      const tier = body.tier;
      if (!isPlanId(tier)) return jsonError("Unknown tier", 400);
      const { data: profile, error: pErr } = await admin
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (pErr) return serverError(SCOPE, pErr, FAILED);

      const current: PlanId = isPlanId(profile?.plan) ? profile.plan : "percuma";
      if (current === tier) return jsonError("You are already on this plan", 400);
      const isUpgrade = PLAN_ORDER.indexOf(tier) > PLAN_ORDER.indexOf(current);
      const amount = isUpgrade ? PLANS[tier].priceRM : 0;

      const { error: uErr } = await admin
        .from("profiles")
        .update({
          plan: tier,
          plan_renews_at:
            tier === "percuma"
              ? null
              : new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .eq("id", user.id);
      if (uErr) return serverError(SCOPE, uErr, FAILED);

      await record("plan", amount, { from: current, to: tier });
      return NextResponse.json({ ok: true, plan: tier });
    }

    // ── scan top-up ────────────────────────────────────────────────────────
    if (body.kind === "topup") {
      const qty = body.qty;
      if (
        typeof qty !== "number" ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > TOPUP_MAX_QTY
      ) {
        return jsonError(
          `qty must be an integer between 1 and ${TOPUP_MAX_QTY}`,
          400
        );
      }
      // One atomic step: two top-ups finishing together both count.
      const bonus = await addBonusScans(user.id, qty);
      await record("topup", qty * TOPUP_PRICE_RM, { qty });
      return NextResponse.json({ ok: true, bonus });
    }

    // ── listing boost (advertisement) ─────────────────────────────────────
    if (body.kind === "boost") {
      const listingId = body.listingId;
      if (typeof listingId !== "string" || !getListing(listingId)) {
        return jsonError("Unknown listing", 404);
      }
      const packageId = body.package;
      if (!isBoostPackageId(packageId)) {
        return jsonError("Unknown boost package", 400);
      }
      const { data: active, error: bErr } = await admin
        .from("listing_boosts")
        .select("id")
        .eq("listing_id", listingId)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (bErr) return serverError(SCOPE, bErr, FAILED);
      if (active && active.length > 0) {
        return jsonError("This listing is already promoted", 409);
      }

      const pkg = BOOST_PACKAGES[packageId];
      const expiresAt = new Date(Date.now() + pkg.days * 86_400_000).toISOString();
      const { error: iErr } = await admin.from("listing_boosts").insert({
        user_id: user.id,
        listing_id: listingId,
        package: pkg.id,
        price_rm: pkg.priceRM,
        expires_at: expiresAt,
      });
      if (iErr) return serverError(SCOPE, iErr, FAILED);

      await record("boost", pkg.priceRM, { listingId, package: pkg.id });
      return NextResponse.json({
        ok: true,
        boost: { listingId, package: pkg.id, expiresAt },
      });
    }

    return jsonError("kind must be 'plan', 'topup' or 'boost'", 400);
  } catch (e) {
    return serverError(SCOPE, e, FAILED);
  }
}
