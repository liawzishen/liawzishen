import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

/**
 * POST /api/payments — the single place money "moves" (simulated).
 * The client says WHAT to buy, never the price: every amount is derived from
 * lib/billing/plans.ts. Effects are applied with the service-role client
 * because billing tables/columns are read-only for browsers (0005 RLS).
 * PRODUCTION SWAP POINT: replace the simulated success with a real gateway
 * call (Revenue Monster / Stripe Malaysia) and keep everything else.
 */

type Body = {
  kind?: string;
  method?: string;
  tier?: string;
  qty?: number;
  listingId?: string;
  package?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const method = body.method;
  if (method !== "fpx" && method !== "tng") {
    return NextResponse.json(
      { error: "method must be 'fpx' or 'tng'" },
      { status: 400 }
    );
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
      if (!isPlanId(body.tier)) {
        return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
      }
      const { data: profile, error: pErr } = await admin
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

      const current: PlanId = isPlanId(profile?.plan) ? profile.plan : "percuma";
      if (current === body.tier) {
        return NextResponse.json(
          { error: "You are already on this plan" },
          { status: 400 }
        );
      }
      const isUpgrade = PLAN_ORDER.indexOf(body.tier) > PLAN_ORDER.indexOf(current);
      const amount = isUpgrade ? PLANS[body.tier].priceRM : 0;

      const { error: uErr } = await admin
        .from("profiles")
        .update({
          plan: body.tier,
          plan_renews_at:
            body.tier === "percuma"
              ? null
              : new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .eq("id", user.id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

      await record("plan", amount, { from: current, to: body.tier });
      return NextResponse.json({ ok: true, plan: body.tier });
    }

    // ── scan top-up ────────────────────────────────────────────────────────
    if (body.kind === "topup") {
      const qty = body.qty;
      if (!Number.isInteger(qty) || !qty || qty < 1 || qty > TOPUP_MAX_QTY) {
        return NextResponse.json(
          { error: `qty must be an integer between 1 and ${TOPUP_MAX_QTY}` },
          { status: 400 }
        );
      }
      const { data: profile, error: pErr } = await admin
        .from("profiles")
        .select("bonus_scans")
        .eq("id", user.id)
        .single();
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

      const bonus = Math.max(0, profile?.bonus_scans ?? 0) + qty;
      const { error: uErr } = await admin
        .from("profiles")
        .update({ bonus_scans: bonus })
        .eq("id", user.id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

      await record("topup", qty * TOPUP_PRICE_RM, { qty });
      return NextResponse.json({ ok: true, bonus });
    }

    // ── listing boost (advertisement) ─────────────────────────────────────
    if (body.kind === "boost") {
      if (!body.listingId || !getListing(body.listingId)) {
        return NextResponse.json({ error: "Unknown listing" }, { status: 404 });
      }
      if (!isBoostPackageId(body.package)) {
        return NextResponse.json({ error: "Unknown boost package" }, { status: 400 });
      }
      const { data: active, error: bErr } = await admin
        .from("listing_boosts")
        .select("id")
        .eq("listing_id", body.listingId)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
      if (active && active.length > 0) {
        return NextResponse.json(
          { error: "This listing is already promoted" },
          { status: 409 }
        );
      }

      const pkg = BOOST_PACKAGES[body.package];
      const expiresAt = new Date(Date.now() + pkg.days * 86_400_000).toISOString();
      const { error: iErr } = await admin.from("listing_boosts").insert({
        user_id: user.id,
        listing_id: body.listingId,
        package: pkg.id,
        price_rm: pkg.priceRM,
        expires_at: expiresAt,
      });
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

      await record("boost", pkg.priceRM, {
        listingId: body.listingId,
        package: pkg.id,
      });
      return NextResponse.json({
        ok: true,
        boost: { listingId: body.listingId, package: pkg.id, expiresAt },
      });
    }

    return NextResponse.json(
      { error: "kind must be 'plan', 'topup' or 'boost'" },
      { status: 400 }
    );
  } catch (e) {
    console.error("[/api/payments]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment failed" },
      { status: 500 }
    );
  }
}
