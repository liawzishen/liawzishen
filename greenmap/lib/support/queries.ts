import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/user";
import type {
  OrderFeedback,
  RefundRequest,
  SupportMessage,
  SupportThread,
} from "@/types/database";

/*
 * What the customer-service pages read from the database (refund requests,
 * support messages, feedback). The tables come from migrations 0007/0008;
 * when they are missing the queries fail, and the loaders answer "not ready"
 * or "no history" instead of crashing the page.
 */

/**
 * Group seller messages into conversations — one per customer + order —
 * with the most recently active conversation first. Messages keep the order
 * they were given in (oldest first).
 */
export function groupSupportThreads(
  messages: readonly SupportMessage[]
): SupportMessage[][] {
  const threads = new Map<string, SupportMessage[]>();
  for (const message of messages) {
    const key = `${message.user_id}::${message.order_ref ?? ""}`;
    const thread = threads.get(key) ?? [];
    thread.push(message);
    threads.set(key, thread);
  }
  const lastActivity = (thread: SupportMessage[]) =>
    new Date(thread[thread.length - 1].created_at).getTime();
  return [...threads.values()].sort((a, b) => lastActivity(b) - lastActivity(a));
}

export interface SellerInbox {
  refunds: RefundRequest[];
  /** Customer conversations, most recently active first. */
  threads: SupportMessage[][];
  feedback: OrderFeedback[];
  /** False when the support tables/policies are not set up yet. */
  ready: boolean;
}

/**
 * The grower's Customer Service inbox, or null when the farm is not the
 * signed-in grower's. RLS (migration 0008) returns only rows for farms this
 * grower owns. The ownership check and the three inbox queries run together.
 */
export const getSellerInbox = cache(
  async (farmId: string): Promise<SellerInbox | null> => {
    const supabase = await createClient();
    const [{ data: farm }, refunds, messages, feedback] = await Promise.all([
      supabase.from("farms").select("id").eq("id", farmId).maybeSingle(),
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
    if (!farm) return null;

    return {
      refunds: (refunds.data as RefundRequest[]) ?? [],
      threads: groupSupportThreads((messages.data as SupportMessage[]) ?? []),
      feedback: (feedback.data as OrderFeedback[]) ?? [],
      ready: !(refunds.error || messages.error || feedback.error),
    };
  }
);

export interface OrderSupportState {
  /** The signed-in shopper (null when signed out). */
  userId: string | null;
  /** Their latest refund/return request for this order, if any. */
  refund: RefundRequest | null;
  /** Their latest feedback for this order, if any. */
  feedback: OrderFeedback | null;
  /** False when the support tables are not set up yet. */
  supportReady: boolean;
}

/** The shopper's order page: their own refund request and feedback. */
export const getOrderSupport = cache(
  async (orderRef: string): Promise<OrderSupportState> => {
    const [supabase, user] = await Promise.all([createClient(), getAuthUser()]);
    if (!user) {
      return { userId: null, refund: null, feedback: null, supportReady: true };
    }

    const latest = (table: "refund_requests" | "order_feedback") =>
      supabase
        .from(table)
        .select("*")
        .eq("user_id", user.id)
        .eq("order_ref", orderRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const [refund, feedback] = await Promise.all([
      latest("refund_requests"),
      latest("order_feedback"),
    ]);

    return {
      userId: user.id,
      refund: (refund.data as RefundRequest) ?? null,
      feedback: (feedback.data as OrderFeedback) ?? null,
      // A PostgREST error here (e.g. undefined_table 42P01) means migration
      // 0007 hasn't been applied — Supabase returns it, it doesn't throw.
      supportReady: !(refund.error || feedback.error),
    };
  }
);

export type ChatMessage = Pick<SupportMessage, "sender" | "body">;

/** How many stored messages a chat page loads. */
const CHAT_HISTORY_LIMIT = 50;

/**
 * The shopper's stored messages in one chat (oldest first). `orderRef` null
 * means the general chat that is not about an order. Empty when signed out
 * or when the table is not there yet.
 */
export const getSupportHistory = cache(
  async (thread: SupportThread, orderRef: string | null): Promise<ChatMessage[]> => {
    const [supabase, user] = await Promise.all([createClient(), getAuthUser()]);
    if (!user) return [];
    try {
      const query = supabase
        .from("support_messages")
        .select("sender, body, created_at")
        .eq("user_id", user.id)
        .eq("thread", thread)
        .order("created_at", { ascending: true })
        .limit(CHAT_HISTORY_LIMIT);
      const { data } = await (orderRef
        ? query.eq("order_ref", orderRef)
        : query.is("order_ref", null));
      return ((data ?? []) as SupportMessage[]).map((row) => ({
        sender: row.sender,
        body: row.body,
      }));
    } catch {
      return []; // table not there yet — start fresh
    }
  }
);
