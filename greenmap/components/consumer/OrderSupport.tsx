"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
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
  const [saved, setSaved] = useState("");

  return (
    <div className="mt-5 px-5">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Need help with this order?
      </h2>

      {/* On success the sheet closes and a row silently swaps in behind it —
          nothing moves focus, so the outcome has to be announced. */}
      <p role="status" aria-live="polite" className="sr-only">
        {saved}
      </p>

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
            trailing={<StarsStatic value={feedback.rating} />}
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
            // A JSX string prop is not HTML — "&amp;" was rendering literally.
            sub="AI assistant — figures out your issue & guides you"
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
          setSaved(
            `${kind === "return" ? "Return" : "Refund"} request submitted — pending review.`
          );
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
          setSaved(`Feedback saved — you rated this order ${rating} out of 5.`);
          setSheet(null);
          return {};
        }}
      />
    </div>
  );
}

/* ── Refund sheet ─────────────────────────────────────────────────────────── */

const KINDS: RefundKind[] = ["refund", "return"];

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
  const kindRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tooShort = reason.trim().length < 3;
  /*
   * A silently disabled submit is a dead end — the two things that can block
   * it (support unavailable, reason too short) are spelled out under it.
   */
  const blockedReason = disabled
    ? "Refund requests aren't available right now."
    : tooShort
      ? "Add a short description (at least 3 characters) to submit."
      : null;

  // Radiogroup: arrow keys move between the two options and select as they go.
  function onKindKey(e: React.KeyboardEvent, i: number) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + KINDS.length) % KINDS.length;
    setKind(KINDS[next]);
    kindRefs.current[next]?.focus();
  }

  async function submit(e: React.FormEvent) {
    // Native <form>, so Enter in the textarea's neighbours submits too.
    e.preventDefault();
    if (busy) return;
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

      <form onSubmit={submit}>
        <div role="radiogroup" aria-label="Request type" className="mt-4 flex gap-2">
          {KINDS.map((k, i) => (
            <button
              key={k}
              ref={(el) => {
                kindRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={kind === k}
              // Roving tabindex: the pair is a single tab stop.
              tabIndex={kind === k ? 0 : -1}
              onClick={() => setKind(k)}
              onKeyDown={(e) => onKindKey(e, i)}
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
          // A placeholder is not a label, and the ring is this field's only
          // boundary — at /40 it was under the 3:1 non-text floor.
          aria-label="What went wrong?"
          className="mt-3 w-full resize-none rounded-input bg-white/80 p-3 text-[15px] outline-none ring-1 ring-tertiary focus:ring-brand"
        />

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-critical-ink">
            {error}
          </p>
        )}
        {blockedReason && (
          <p className="mt-2 text-[12px] text-secondary">{blockedReason}</p>
        )}

        <div className="mt-4">
          <Button
            type="submit"
            full
            busy={busy}
            disabled={disabled || tooShort}
          >
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
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

  async function submit(e: React.FormEvent) {
    // Native <form>, so Enter submits from the fields instead of doing nothing.
    e.preventDefault();
    if (busy) return;
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

      <form onSubmit={submit}>
        <div className="mt-4 flex justify-center">
          <Stars value={rating} onChange={setRating} />
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)"
          rows={3}
          // A placeholder is not a label, and the ring is this field's only
          // boundary — at /40 it was under the 3:1 non-text floor.
          aria-label="Comment (optional)"
          className="mt-3 w-full resize-none rounded-input bg-white/80 p-3 text-[15px] outline-none ring-1 ring-tertiary focus:ring-brand"
        />

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-critical-ink">
            {error}
          </p>
        )}
        {disabled && (
          <p className="mt-2 text-[12px] text-secondary">
            Feedback isn&apos;t available right now.
          </p>
        )}

        <div className="mt-4">
          <Button type="submit" full busy={busy} disabled={disabled}>
            {busy ? "Submitting…" : "Submit feedback"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

/* ── Small UI helpers ─────────────────────────────────────────────────────── */

const STAR_VALUES = [1, 2, 3, 4, 5];

/**
 * Star rating — five buttons that pick ONE value, so it is an APG radiogroup:
 * one tab stop, arrow keys move and select, and each star names the rating it
 * sets ("Rate 3 of 5") instead of announcing a bare "3 stars" button. The
 * glyph itself is decorative; `aria-checked` carries the state, which colour
 * alone never did.
 */
function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, value + step));
    onChange(next);
    refs.current[next - 1]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {STAR_VALUES.map((n) => (
        <button
          key={n}
          ref={(el) => {
            refs.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`Rate ${n} of 5`}
          // Roving tabindex: the whole group is a single tab stop.
          tabIndex={n === value ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={onKey}
          className={`text-[30px] leading-none active:scale-90 ${
            n <= value ? "text-warning-ink" : "text-tertiary"
          }`}
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
}

/** Already-submitted rating: one image with a name, not five dead buttons. */
function StarsStatic({ value }: { value: number }) {
  return (
    <span
      role="img"
      aria-label={`Rated ${value} out of 5`}
      className="flex shrink-0 gap-1 text-[16px] leading-none"
    >
      {STAR_VALUES.map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={n <= value ? "text-warning-ink" : "text-tertiary"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function labelFor(status: RefundRequest["status"]) {
  return status === "pending" ? "Pending review" : status === "approved" ? "Approved" : "Rejected";
}

// The raw hues were painted as pill TEXT, where they failed contrast. Badge
// pairs each tint with its verified ink colour.
const REFUND_TONE: Record<RefundRequest["status"], "brand" | "critical" | "warning"> = {
  approved: "brand",
  rejected: "critical",
  pending: "warning",
};

function StatusPill({ status }: { status: RefundRequest["status"] }) {
  return (
    <Badge tone={REFUND_TONE[status]} className="shrink-0">
      {labelFor(status)}
    </Badge>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  // Row emoji are decorative — the row's title is what names it.
  return (
    <span aria-hidden="true" className="text-[18px]">
      {children}
    </span>
  );
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
  return (
    <span aria-hidden="true" className="text-tertiary">
      ›
    </span>
  );
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
