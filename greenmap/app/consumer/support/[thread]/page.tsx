import { notFound } from "next/navigation";
import { getSupportHistory } from "@/lib/support/queries";
import { TopNav } from "@/components/layout/TopNav";
import { SupportChat } from "@/components/consumer/SupportChat";
import { getOrder, STATUS_META } from "@/components/consumer/demo-consumer";

/**
 * Support chat page — /consumer/support/admin or /consumer/support/seller,
 * with an optional ?order=<id> for context. Loads any stored history (RLS,
 * degrades to none if migration 0007 isn't applied) and hands it to the
 * shared SupportChat client component.
 */
export default async function SupportChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ thread: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { thread } = await params;
  if (thread !== "admin" && thread !== "seller") notFound();
  const { order: orderId } = await searchParams;
  const order = orderId ? getOrder(orderId) : undefined;

  const orderContext = order
    ? {
        item: order.item,
        farm: order.farm,
        status: STATUS_META[order.status].label,
        total: order.total,
      }
    : null;

  const initialMessages = await getSupportHistory(thread, order?.id ?? null);

  const title =
    thread === "admin" ? "GreenMap Admin" : `Chat · ${order?.farm ?? "Seller"}`;
  const backHref = order ? `/consumer/orders/${order.id}` : "/consumer/profile";

  return (
    <main>
      <TopNav title={title} backHref={backHref} />
      <SupportChat
        thread={thread}
        orderRef={order?.id ?? null}
        sellerName={order?.farm ?? null}
        orderContext={orderContext}
        initialMessages={initialMessages}
      />
    </main>
  );
}
