"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CheckoutSheet,
  type PaymentPayload,
} from "@/components/billing/CheckoutSheet";
import {
  PLANS,
  PLAN_ORDER,
  TOPUP_PRICE_RM,
  TOPUP_MAX_QTY,
  formatRM,
  type PlanId,
} from "@/lib/billing/plans";
import type { ScanAllowance } from "@/lib/billing/usage";

export type PaymentRow = {
  id: string;
  kind: string;
  amount_rm: number;
  method: string;
  created_at: string;
  meta: Record<string, unknown> | null;
};

const KIND_LABEL: Record<string, string> = {
  plan: "Plan change",
  topup: "Scan top-up",
  boost: "Listing boost",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function PlanPageClient({
  farmId,
  allowance,
  payments,
}: {
  farmId: string;
  allowance: ScanAllowance;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<{
    title: string;
    amountRM: number;
    lines: Array<[string, string]>;
    payload: PaymentPayload;
  } | null>(null);
  const [qty, setQty] = useState(2);
  const [switching, setSwitching] = useState(false);

  const current = PLANS[allowance.plan];
  const total = (allowance.limit ?? 0) + allowance.bonus;
  const resetLabel = new Date(allowance.resetsOn).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });

  async function downgrade(tier: PlanId) {
    const name = PLANS[tier].name;
    if (
      !window.confirm(`Switch to ${name}? Downgrades are free and apply immediately.`)
    ) {
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", tier, method: "fpx" }),
      });
      if (!res.ok) {
        const data = await res.json();
        window.alert(data?.error ?? "Could not switch plan");
      }
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="px-5 pt-2">
      {allowance.degraded && (
        <p className="mb-4 rounded-input bg-warning/15 p-3 text-[13px] text-warning">
          Billing isn&apos;t set up on this backend yet — run{" "}
          <code>supabase/migrations/0005_billing.sql</code> in the Supabase SQL
          editor. Scans are not limited until then.
        </p>
      )}

      {/* ── Current plan ── */}
      <section className="rounded-card p-5 glass">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
              Current plan
            </p>
            <h1 className="mt-0.5 text-[24px] font-bold">{current.name}</h1>
            <p className="text-[13px] text-secondary">{current.tagline}</p>
          </div>
          <Badge tone="brand">
            {current.priceRM === 0 ? "Free" : `${formatRM(current.priceRM)}/mo`}
          </Badge>
        </div>

        {allowance.limit === null ? (
          <p className="mt-4 text-[14px] font-medium">🔬 Unlimited AI scans</p>
        ) : (
          <>
            <div className="mt-4 flex items-baseline justify-between text-[13px]">
              <span className="font-medium">
                🔬 {allowance.used} of {total} scans used
              </span>
              <span className="text-secondary">resets {resetLabel}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{
                  width: `${Math.min(100, (allowance.used / Math.max(1, total)) * 100)}%`,
                }}
              />
            </div>
            {allowance.bonus > 0 && (
              <p className="mt-2 text-[12px] text-secondary">
                includes {allowance.bonus} top-up scan
                {allowance.bonus === 1 ? "" : "s"}
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Tiers ── */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Plans
      </h2>
      <div className="space-y-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === allowance.plan;
          const isUpgrade =
            PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(allowance.plan);
          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-card p-4 glass"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">
                  {p.name}
                  <span className="ml-2 text-[13px] font-normal text-secondary">
                    {p.tagline}
                  </span>
                </p>
                <p className="mt-0.5 text-[13px] text-secondary">
                  {p.scansPerMonth === null
                    ? "Unlimited scans"
                    : `${p.scansPerMonth} scans/month`}{" "}
                  · {p.priceRM === 0 ? "Free" : `${formatRM(p.priceRM)}/month`}
                </p>
              </div>
              {isCurrent ? (
                <Badge tone="neutral">Current</Badge>
              ) : isUpgrade ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setCheckout({
                      title: `Upgrade to ${p.name}`,
                      amountRM: p.priceRM,
                      lines: [[`${p.name} · monthly`, formatRM(p.priceRM)]],
                      payload: { kind: "plan", tier: id },
                    })
                  }
                >
                  Upgrade
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="fill"
                  disabled={switching}
                  onClick={() => downgrade(id)}
                >
                  Switch
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Top-up ── */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Top-up scans
      </h2>
      <div className="rounded-card p-4 glass">
        <p className="text-[14px]">
          Need a few more scans without upgrading?{" "}
          <b>{formatRM(TOPUP_PRICE_RM)}</b> per scan — they never expire.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full bg-fill px-2 py-1">
            <button
              type="button"
              aria-label="Fewer scans"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold active:bg-white/60"
            >
              −
            </button>
            <span className="w-6 text-center text-[16px] font-bold">{qty}</span>
            <button
              type="button"
              aria-label="More scans"
              onClick={() => setQty((q) => Math.min(TOPUP_MAX_QTY, q + 1))}
              className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold active:bg-white/60"
            >
              ＋
            </button>
          </div>
          <Button
            className="flex-1"
            onClick={() =>
              setCheckout({
                title: "Top up AI scans",
                amountRM: qty * TOPUP_PRICE_RM,
                lines: [
                  [
                    `${qty} scan${qty === 1 ? "" : "s"} × ${formatRM(TOPUP_PRICE_RM)}`,
                    formatRM(qty * TOPUP_PRICE_RM),
                  ],
                ],
                payload: { kind: "topup", qty },
              })
            }
          >
            Top up · {formatRM(qty * TOPUP_PRICE_RM)}
          </Button>
        </div>
      </div>

      {/* ── Payment history ── */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Payment history
      </h2>
      <div className="overflow-hidden rounded-card glass">
        {payments.length === 0 ? (
          <p className="p-4 text-[14px] text-secondary">No payments yet.</p>
        ) : (
          payments.map((pay, i) => (
            <div
              key={pay.id}
              className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">
                  {KIND_LABEL[pay.kind] ?? pay.kind}
                </p>
                <p className="text-[12px] text-secondary">
                  {fmtDate(pay.created_at)} ·{" "}
                  {pay.method === "tng" ? "Touch 'n Go" : "FPX"}
                </p>
              </div>
              <span className="text-[14px] font-semibold">
                {formatRM(Number(pay.amount_rm))}
              </span>
              <Badge tone="neutral">Simulated</Badge>
            </div>
          ))
        )}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-secondary">
        <span>🔒</span>
        <span>
          Demo mode — transactions are simulated. Gateway integration ready for
          production.
        </span>
      </p>

      {checkout && (
        <CheckoutSheet
          open
          onClose={() => setCheckout(null)}
          title={checkout.title}
          amountRM={checkout.amountRM}
          lines={checkout.lines}
          payload={checkout.payload}
        />
      )}
    </div>
  );
}
