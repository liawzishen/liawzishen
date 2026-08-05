"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { formatRM, type BoostPackageId, type PlanId } from "@/lib/billing/plans";

/**
 * Simulated FPX / Touch 'n Go checkout used by plan upgrades, scan top-ups
 * and listing boosts. Mirrors the marketplace's mock checkout styling.
 * The sheet sends WHAT to buy — /api/payments derives the price server-side.
 */

export type PaymentPayload =
  | { kind: "plan"; tier: PlanId }
  | { kind: "topup"; qty: number }
  | { kind: "boost"; listingId: string; package: BoostPackageId };

const FPX_BANKS = ["Maybank2u", "CIMB Clicks", "Public Bank", "Bank Islam"];

type Phase = "method" | "processing" | "success" | "error";

export function CheckoutSheet({
  open,
  onClose,
  title,
  amountRM,
  lines,
  payload,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  amountRM: number;
  lines: Array<[string, string]>;
  payload: PaymentPayload;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("method");
  const [method, setMethod] = useState<"fpx" | "tng">("fpx");
  const [bank, setBank] = useState(FPX_BANKS[0]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("method");
      setErrorMsg("");
    }
  }, [open]);

  async function pay() {
    setPhase("processing");
    // Simulated bank/eWallet handshake — the production gateway call
    // replaces this block (single swap point, see /api/payments).
    await new Promise((r) => setTimeout(r, 1800));
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Payment failed");
      setPhase("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment failed");
      setPhase("error");
    }
  }

  function done() {
    onClose();
    router.refresh();
  }

  const close =
    phase === "processing" ? () => {} : phase === "success" ? done : onClose;

  return (
    <BottomSheet open={open} onClose={close} ariaLabel={title}>
      <h2 className="text-[18px] font-bold">{title}</h2>

      {phase === "method" && (
        <>
          <div className="mt-3 rounded-card bg-fill p-4 text-[14px]">
            {lines.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-secondary">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-tertiary pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-brand">{formatRM(amountRM)}</span>
            </div>
          </div>

          <p className="mt-4 text-[13px] font-semibold uppercase tracking-wide text-secondary">
            Payment method
          </p>
          <div className="mt-2 space-y-2">
            <MethodRow
              icon="🏦"
              title="FPX Online Banking"
              sub="Maybank, CIMB, Public Bank…"
              on={method === "fpx"}
              onClick={() => setMethod("fpx")}
            />
            {method === "fpx" && (
              <div className="flex flex-wrap gap-2 px-1">
                {FPX_BANKS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBank(b)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
                      bank === b ? "bg-brand text-white" : "bg-fill text-label"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
            <MethodRow
              icon="📱"
              title="Touch 'n Go eWallet"
              sub="Pay with your TnG balance"
              on={method === "tng"}
              onClick={() => setMethod("tng")}
            />
          </div>

          <Button full className="mt-5" onClick={pay}>
            Pay {formatRM(amountRM)}
          </Button>
        </>
      )}

      {phase === "processing" && (
        <div className="py-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-fill border-t-brand" />
          <p className="mt-4 text-[15px] font-medium">
            {method === "fpx" ? `Connecting to ${bank}…` : "Opening Touch 'n Go…"}
          </p>
          <p className="mt-1 text-[13px] text-secondary">Do not close this screen.</p>
        </div>
      )}

      {phase === "success" && (
        <div className="py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-[32px]">
            ✓
          </div>
          <h3 className="mt-4 text-[20px] font-bold">Payment successful</h3>
          <p className="mt-1 text-[14px] text-secondary">
            {formatRM(amountRM)} ·{" "}
            {method === "fpx" ? `FPX (${bank})` : "Touch 'n Go"} · simulated
          </p>
          <Button full className="mt-6" onClick={done}>
            Done
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="py-6 text-center">
          <p className="rounded-input bg-critical/10 p-3 text-[14px] text-critical-ink">
            {errorMsg}
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="fill" full onClick={onClose}>
              Cancel
            </Button>
            <Button full onClick={() => setPhase("method")}>
              Try again
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-secondary">
        <span>🔒</span>
        <span>
          Demo mode — transactions are simulated. Gateway integration ready for
          production.
        </span>
      </p>
    </BottomSheet>
  );
}

function MethodRow({
  icon,
  title,
  sub,
  on,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-card p-3.5 text-left transition active:scale-[0.99] ${
        on ? "bg-brand/10 ring-2 ring-brand" : "bg-fill"
      }`}
    >
      <span className="text-[22px]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[12px] text-secondary">{sub}</span>
      </span>
      <span
        className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
          on ? "border-brand bg-brand text-[11px] text-white" : "border-tertiary"
        }`}
      >
        {on ? "✓" : ""}
      </span>
    </button>
  );
}
