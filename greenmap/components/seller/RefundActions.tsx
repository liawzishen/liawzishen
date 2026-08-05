"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RefundStatus } from "@/types/database";

/**
 * Grower approve/reject for a pending refund. Writes the new status via the
 * grower's own RLS (0008 lets the owning seller UPDATE to approved/rejected) —
 * this is the decision the AI assistant is not allowed to make.
 */
export function RefundActions({ refundId }: { refundId: string }) {
  const [status, setStatus] = useState<RefundStatus | null>(null);
  const [busy, setBusy] = useState<RefundStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(next: "approved" | "rejected") {
    if (busy) return;
    setBusy(next);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("refund_requests")
      .update({ status: next })
      .eq("id", refundId);
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setStatus(next);
  }

  if (status) {
    return (
      <p className="mt-3 text-[13px] font-semibold" style={{ color: status === "approved" ? "#0DB074" : "#EF4444" }}>
        {status === "approved" ? "✓ Approved — the shopper is refunded." : "✕ Rejected."}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={!!busy}
          className="flex-1 rounded-btn bg-brand py-2.5 text-[14px] font-semibold text-white transition active:scale-95 disabled:opacity-50"
        >
          {busy === "approved" ? "…" : "Approve refund"}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={!!busy}
          className="flex-1 rounded-btn bg-fill py-2.5 text-[14px] font-semibold text-critical-ink transition active:scale-95 disabled:opacity-50"
        >
          {busy === "rejected" ? "…" : "Reject"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-critical-ink">{error}</p>}
    </div>
  );
}
