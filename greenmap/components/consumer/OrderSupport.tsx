"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import type {
  ConsumerOrder,
} from "@/components/consumer/demo-consumer";
import type {
  OrderFeedback,
  RefundKind,
  RefundRequest,
} from "@/types/database";

/**
 * Customer-service hub for one order (client). Opens refund/return requests
 * and leaves feedback — both written to Supabase under the customer's own RLS
 * (a refund is created as 'pending' only; approval is a human decision). Also
 * links to the seller chat and the AI admin assistant.
 */
export function OrderSupport({
  userId,
  order,
  existingRefund,
  existingFeedback,
  supportReady,
}: {
  userId: string | null;
  order: ConsumerOrder;
  existingRefund: RefundRequest | null;
  existingFeedback: OrderFeedback | null;
  supportReady: boolean;
}) {
  const [refund, setRefund] = useState<RefundRequest | null>(existingRefund);
  const [feedback, setFeedback] = useState<OrderFeedback | null>(existingFeedback);
  const [sheet, setSheet] = useState<null | "refund" | "feedback">(null);

  return (
    <div className="mt-5 px-5">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Need help with this order?
      </h2>

      {!supportReady && (
        <p className="mb-3 rounded-input bg-warning/12 px-3 py-2.5 text-[12px] text-secondary">
          ⚠️ Refunds &amp; feedback aren&apos;t available right now — you can
          still chat with the seller or our assistant below.
          {process.env.NODE_ENV === "development" && (
            <span className="mt-1 block opacity-80">
              Dev: run migration{" "}
              <code className="rounded bg-black/5 px-1">0007_support.sql</code>{" "}
              in Supabase.
            </span>
          )}
        </p>
      )}

      <div className="overflow-hidden rounded-card glass">
        {/* Refund / return */}
        {refund ? (
          <Row
            icon="💸"
            title={refund.kind === "return" ? "Return requested" : "Refund requested"}
            sub={`Status: ${labelFor(refund.status)} · a seller/admin will review it`}
            trailing={<StatusPill status={refund.status} />}
          />
        ) : (
          <button
            type="button"
            onClick={() => setSheet("refund")}
            className="flex w-full items-center gap-3 p-4 text-left active:bg-fill/40"
          >
            <Icon>💸</Icon>
            <Text title="Request a refund or return" sub="For damaged, wrong or missing items" />
            <Chevron />
          </button>
        )}

        {/* Feedback */}
        {feedback ? (
          <Row
            icon="⭐"
            title="Your feedback"
            sub={feedback.comment || "Thanks for rating this order"}
            trailing={<Stars value={feedback.rating} readOnly />}
            top
          />
        ) : (
          <button
            type="button"
            onClick={() => setSheet("feedback")}
            className="hairline-t flex w-full items-center gap-3 p-4 text-left active:bg-fill/40"
          >
            <Icon>⭐</Icon>
            <Text title="Leave feedback" sub="Rate this order and the produce" />
            <Chevron />
          </button>
        )}

        {/* Contact seller */}
        <Link
          href={`/consumer/support/seller?order=${order.id}`}
          className="hairline-t flex items-center gap-3 p-4 active:bg-fill/40"
        >
          <Icon>💬</Icon>
          <Text title="Contact the seller" sub={`Message ${order.farm} directly`} />
          <Chevron />
        </Link>

        {/* AI admin */}
        <Link
          href={`/consumer/support/admin?order=${order.id}`}
          className="hairline-t flex items-center gap-3 p-4 active:bg-fill/40"
        >
          <Icon>🤖</Icon>
          <Text
            title="Ask the GreenMap admin"
            sub="AI assistant — figures out your issue &amp; guides you"
          />
          <Chevron />
        </Link>
      </div>

      {/* ── Refund sheet ── */}
      <RefundSheet
        open={sheet === "refund"}
        onClose={() => setSheet(null)}
        disabled={!supportReady || !userId}
        onSubmit={async (kind, reason) => {
          if (!userId) return { error: "Not signed in" };
          const supabase = createClient();
          const { data, error } = await supabase
            .from("refund_requests")
            .insert({
              user_id: userId,
              order_ref: order.id,
              item: order.item,
              farm: order.farm,
              kind,
              reason,
              status: "pending",
            })
            .select()
            .single();
          if (error) return { error: error.message };
          setRefund(data as RefundRequest);
          setSheet(null);
          return {};
        }}
      />

      {/* ── Feedback sheet ── */}
      <FeedbackSheet
        open={sheet === "feedback"}
        onClose={() => setSheet(null)}
        disabled={!supportReady || !userId}
        onSubmit={async (rating, comment) => {
          if (!userId) return { error: "Not signed in" };
          const supabase = createClient();
          const { data, error } = await supabase
            .from("order_feedback")
            .insert({
              user_id: userId,
              order_ref: order.id,
              listing_id: null,
              farm: order.farm,
              rating,
              comment,
            })
            .select()
            .single();
          if (error) return { error: error.message };
          setFeedback(data as OrderFeedback);
          setSheet(null);
          return {};
        }}
      />
    </div>
  );
}

/* ── Refund sheet ─────────────────────────────────────────────────────────── */

function RefundSheet({
  open,
  onClose,
  disabled,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  disabled: boolean;
  onSubmit: (kind: RefundKind, reason: string) => Promise<{ error?: string }>;
}) {
  const [kind, setKind] = useState<RefundKind>("refund");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await onSubmit(kind, reason.trim());
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Request a refund or return">
      <h2 className="text-[20px] font-bold">Request a refund or return</h2>
      <p className="mt-1 text-[13px] text-secondary">
        This opens a request the seller/admin reviews — it isn&apos;t approved
        automatically.
      </p>

      <div className="mt-4 flex gap-2">
        {(["refund", "return"] as RefundKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 rounded-input p-3 text-[14px] font-semibold capitalize transition ${
              kind === k ? "bg-brand text-white" : "bg-fill text-label"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What went wrong? (e.g. items arrived crushed)"
        rows={3}
        className="mt-3 w-full resize-none rounded-input bg-white/80 p-3 text-[15px] outline-none ring-1 ring-tertiary/40 focus:ring-brand"
      />

      {error && <p className="mt-2 text-[13px] text-critical">{error}</p>}

      <div className="mt-4">
        <Button full disabled={disabled || busy || reason.trim().length < 3} onClick={submit}>
          {busy ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </BottomSheet>
  );
}

/* ── Feedback sheet ───────────────────────────────────────────────────────── */

function FeedbackSheet({
  open,
  onClose,
  disabled,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  disabled: boolean;
  onSubmit: (rating: number, comment: string) => Promise<{ error?: string }>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await onSubmit(rating, comment.trim());
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Leave feedback">
      <h2 className="text-[20px] font-bold">Leave feedback</h2>
      <p className="mt-1 text-[13px] text-secondary">
        How was this order? Your rating helps other shoppers.
      </p>

      <div className="mt-4 flex justify-center">
        <Stars value={rating} onChange={setRating} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)"
        rows={3}
        className="mt-3 w-full resize-none rounded-input bg-white/80 p-3 text-[15px] outline-none ring-1 ring-tertiary/40 focus:ring-brand"
      />

      {error && <p className="mt-2 text-[13px] text-critical">{error}</p>}

      <div className="mt-4">
        <Button full disabled={disabled || busy} onClick={submit}>
          {busy ? "Submitting…" : "Submit feedback"}
        </Button>
      </div>
    </BottomSheet>
  );
}

/* ── Small UI helpers ─────────────────────────────────────────────────────── */

function Stars({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`${readOnly ? "text-[16px]" : "text-[30px]"} leading-none ${
            n <= value ? "text-warning" : "text-tertiary"
          } ${readOnly ? "" : "active:scale-90"}`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function labelFor(status: RefundRequest["status"]) {
  return status === "pending" ? "Pending review" : status === "approved" ? "Approved" : "Rejected";
}

function StatusPill({ status }: { status: RefundRequest["status"] }) {
  const tone =
    status === "approved" ? "#0DB074" : status === "rejected" ? "#EF4444" : "#F59E0B";
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: `${tone}1A`, color: tone }}
    >
      {labelFor(status)}
    </span>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="text-[18px]">{children}</span>;
}
function Text({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[14px] font-medium">{title}</span>
      <span className="block text-[12px] text-secondary">{sub}</span>
    </span>
  );
}
function Chevron() {
  return <span className="text-tertiary">›</span>;
}
function Row({
  icon,
  title,
  sub,
  trailing,
  top,
}: {
  icon: string;
  title: string;
  sub: string;
  trailing?: React.ReactNode;
  top?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 ${top ? "hairline-t" : ""}`}>
      <Icon>{icon}</Icon>
      <Text title={title} sub={sub} />
      {trailing}
    </div>
  );
}
