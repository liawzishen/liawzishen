import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { RefundActions } from "@/components/seller/RefundActions";
import { SellerThread } from "@/components/seller/SellerThread";
import { getFarmBundle } from "@/lib/farm/fetch";
import type {
  OrderFeedback,
  RefundRequest,
  SupportMessage,
} from "@/types/database";

/**
 * Grower Customer Service inbox. RLS (migration 0008) returns only support
 * rows whose farm this grower owns — refund requests they can approve/reject,
 * customer message threads they can reply to, and feedback. Degrades to a
 * "run 0007/0008" notice if the tables/policies aren't there yet.
 */
export default async function SellerSupportPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const bundle = await getFarmBundle(farmId);
  if (!bundle) notFound();

  const supabase = await createClient();

  let refunds: RefundRequest[] = [];
  let messages: SupportMessage[] = [];
  let feedback: OrderFeedback[] = [];
  let ready = true;

  const [r, m, f] = await Promise.all([
    supabase
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("support_messages")
      .select("*")
      .eq("thread", "seller")
      .order("created_at", { ascending: true }),
    supabase
      .from("order_feedback")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);
  if (r.error || m.error || f.error) ready = false;
  refunds = (r.data as RefundRequest[]) ?? [];
  messages = (m.data as SupportMessage[]) ?? [];
  feedback = (f.data as OrderFeedback[]) ?? [];

  // Group seller messages into threads keyed by customer + order.
  const threads = new Map<string, SupportMessage[]>();
  for (const msg of messages) {
    const key = `${msg.user_id}::${msg.order_ref ?? ""}`;
    const arr = threads.get(key) ?? [];
    arr.push(msg);
    threads.set(key, arr);
  }
  const threadList = [...threads.values()].sort(
    (a, b) =>
      new Date(b[b.length - 1].created_at).getTime() -
      new Date(a[a.length - 1].created_at).getTime()
  );

  const pending = refunds.filter((x) => x.status === "pending");
  const closed = refunds.filter((x) => x.status !== "pending");

  return (
    <main id="main-content" className="pb-16">
      <TopNav title="Customer Service" backHref={`/farms/${farmId}/sales`} />

      <div className="px-5 pt-2">
        {!ready && (
          <p className="mb-4 rounded-input bg-warning/12 px-3 py-2.5 text-[13px] text-secondary">
            <span aria-hidden>⚠️</span> Customer service isn&apos;t available
            right now — check back soon.
            {process.env.NODE_ENV === "development" && (
              <span className="mt-1 block text-[12px] opacity-80">
                Dev: run{" "}
                <code className="rounded bg-black/5 px-1">0007_support.sql</code>{" "}
                and{" "}
                <code className="rounded bg-black/5 px-1">
                  0008_seller_support.sql
                </code>{" "}
                in Supabase.
              </span>
            )}
          </p>
        )}

        {ready &&
          refunds.length === 0 &&
          threadList.length === 0 &&
          feedback.length === 0 && (
            <div className="mt-10 rounded-card p-6 text-center glass">
              <p className="text-[15px] font-medium">No customer requests yet 🌾</p>
              <p className="mt-1 text-[13px] text-secondary">
                Refund requests, messages and feedback for your listings appear
                here.
              </p>
            </div>
          )}

        {/* Refund requests */}
        {refunds.length > 0 && (
          <section>
            <h2 className="mb-2 mt-2 text-[13px] font-semibold uppercase tracking-wide text-secondary">
              Refund &amp; return requests
              {pending.length > 0 && (
                <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning-ink">
                  {pending.length} pending
                </span>
              )}
            </h2>
            <div className="space-y-3">
              {[...pending, ...closed].map((rq) => (
                <div key={rq.id} className="rounded-card p-4 glass">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold capitalize">
                        {rq.kind} · {rq.item}
                      </p>
                      <p className="mt-0.5 text-[12px] text-secondary">
                        Order #{rq.order_ref} · {rq.farm}
                      </p>
                    </div>
                    <StatusPill status={rq.status} />
                  </div>
                  {rq.reason && (
                    <p className="mt-2 rounded-input bg-fill/60 px-3 py-2 text-[13px]">
                      “{rq.reason}”
                    </p>
                  )}
                  {rq.status === "pending" && <RefundActions refundId={rq.id} />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Message threads */}
        {threadList.length > 0 && (
          <section>
            <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
              Customer messages
            </h2>
            <div className="space-y-3">
              {threadList.map((thread) => (
                <SellerThread
                  key={`${thread[0].user_id}-${thread[0].order_ref}`}
                  customerId={thread[0].user_id}
                  orderRef={thread[0].order_ref}
                  sellerName={thread[0].seller_name}
                  messages={thread.map((t) => ({ sender: t.sender, body: t.body }))}
                />
              ))}
            </div>
          </section>
        )}

        {/* Feedback */}
        {feedback.length > 0 && (
          <section>
            <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
              Feedback
            </h2>
            <div className="space-y-3">
              {feedback.map((fb) => (
                <div key={fb.id} className="rounded-card p-4 glass">
                  <div className="flex items-center justify-between">
                    {/* The glyphs are the whole rating: read aloud they were
                        five identical stars regardless of the score, so the
                        number is given as the label and the stars hidden. */}
                    <span
                      className="text-[15px] text-warning-ink"
                      role="img"
                      aria-label={`${fb.rating} out of 5 stars`}
                    >
                      <span aria-hidden>
                        {"★".repeat(fb.rating)}
                        <span className="text-tertiary">
                          {"★".repeat(5 - fb.rating)}
                        </span>
                      </span>
                    </span>
                    <span className="text-[12px] text-secondary">Order #{fb.order_ref}</span>
                  </div>
                  {fb.comment && <p className="mt-2 text-[14px]">{fb.comment}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/*
 * The pill is a 10% tint of the status hue with the label written in the SAME
 * hue — which put the amber label at roughly 1.7:1 on its own tint. Each entry
 * now carries the bright hue as the FILL and a darkened ink for the LABEL
 * (the same warning/critical/brand-dark inks the design tokens define).
 */
function StatusPill({ status }: { status: RefundRequest["status"] }) {
  const map = {
    pending: { t: "Pending", fill: "#F59E0B", ink: "#8a4b00" },
    approved: { t: "Approved", fill: "#0DB074", ink: "#31572c" },
    rejected: { t: "Rejected", fill: "#EF4444", ink: "#a4160d" },
  }[status];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: `${map.fill}1A`, color: map.ink }}
    >
      {map.t}
    </span>
  );
}
