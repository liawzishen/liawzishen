import { notFound } from "next/navigation";
import { getOrderSupport } from "@/lib/support/queries";
import { TopNav } from "@/components/layout/TopNav";
import { OrderSupport } from "@/components/consumer/OrderSupport";
import { getOrder, STATUS_META } from "@/components/consumer/demo-consumer";

/**
 * Consumer order detail + customer-service hub. The order is mock data; the
 * support layer (refund/return requests, feedback) is real and RLS-scoped.
 * Existing refund/feedback load here and degrade to none if migration 0007
 * hasn't been applied yet.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = getOrder(orderId);
  if (!order) notFound();

  const { userId, refund, feedback, supportReady } = await getOrderSupport(
    order.id
  );

  const status = STATUS_META[order.status];

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title={`Order #${order.id}`} backHref="/consumer/orders" />

      {/* Order summary */}
      <div className="px-5 pt-2">
        <div className="rounded-card p-4 glass">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-input bg-fill text-[26px]">
              {order.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold">{order.item}</p>
              <p className="truncate text-[13px] text-secondary">
                {order.qty} · {order.farm} · {order.date}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: `${status.tone}1A`, color: status.tone }}
            >
              {status.label}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-tertiary/50 pt-3">
            <span className="text-[13px] text-secondary">Total paid</span>
            <span className="text-[17px] font-bold text-brand">RM {order.total}</span>
          </div>
        </div>
      </div>

      <OrderSupport
        userId={userId}
        order={order}
        existingRefund={refund}
        existingFeedback={feedback}
        supportReady={supportReady}
      />
    </main>
  );
}
