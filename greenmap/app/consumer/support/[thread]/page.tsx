import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { SupportChat } from "@/components/consumer/SupportChat";
import { getOrder, STATUS_META } from "@/components/consumer/demo-consumer";
import type { SupportMessage, SupportThread } from "@/types/database";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialMessages: { sender: SupportMessage["sender"]; body: string }[] = [];
  if (user) {
    try {
      let q = supabase
        .from("support_messages")
        .select("sender, body, created_at")
        .eq("user_id", user.id)
        .eq("thread", thread)
        .order("created_at", { ascending: true })
        .limit(50);
      q = order ? q.eq("order_ref", order.id) : q.is("order_ref", null);
      const { data } = await q;
      initialMessages = (data ?? []).map((r) => ({
        sender: (r as SupportMessage).sender,
        body: (r as SupportMessage).body,
      }));
    } catch {
      /* table not there yet — start fresh */
    }
  }

  const title =
    thread === "admin" ? "GreenMap Admin" : `Chat · ${order?.farm ?? "Seller"}`;
  const backHref = order ? `/consumer/orders/${order.id}` : "/consumer/profile";

  return (
    <main>
      <TopNav title={title} backHref={backHref} />
      <SupportChat
        thread={thread as SupportThread}
        orderRef={order?.id ?? null}
        sellerName={order?.farm ?? null}
        orderContext={orderContext}
        initialMessages={initialMessages}
      />
    </main>
  );
}
