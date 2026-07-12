import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ORDERS, STATUS_META } from "@/components/consumer/demo-consumer";

/**
 * Consumer orders (Phase-3 preview). Simulated purchase history grouped
 * newest-first, each with a status pill. No real orders/persistence.
 */
export default function ConsumerOrdersPage() {
  const active = ORDERS.filter((o) => o.status !== "delivered");
  const past = ORDERS.filter((o) => o.status === "delivered");

  return (
    <main className="px-5 pb-8 pt-12 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10">
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          My Orders
        </p>
        <Badge tone="warning">PREVIEW</Badge>
      </div>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">Orders</h1>

      {ORDERS.length === 0 ? (
        <p className="mt-10 text-center text-[14px] text-secondary">
          No orders yet — browse the{" "}
          <Link href="/consumer/market" className="font-semibold text-brand">
            market
          </Link>
          .
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-wide text-secondary">
                Active
              </h2>
              <div className="space-y-3">
                {active.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
                Completed
              </h2>
              <div className="space-y-3">
                {past.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

function OrderCard({ order }: { order: (typeof ORDERS)[number] }) {
  const s = STATUS_META[order.status];
  return (
    <Link
      href={`/consumer/orders/${order.id}`}
      className="block rounded-card p-4 glass active:opacity-90"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-input bg-fill text-[20px]">
          {order.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{order.item}</p>
          <p className="truncate text-[12px] text-secondary">
            {order.qty} · {order.farm} · {order.date}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: `${s.tone}1A`, color: s.tone }}
        >
          {s.label}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-tertiary/50 pt-3">
        <span className="text-[12px] text-secondary">Order #{order.id}</span>
        <span className="text-[15px] font-bold text-brand">RM {order.total}</span>
      </div>
    </Link>
  );
}
