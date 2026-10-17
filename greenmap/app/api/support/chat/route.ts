import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  geminiSupportTriage,
  mockSupportTriage,
  type SupportTurn,
  type SupportReply,
} from "@/lib/ai/gemini-support";
import type { SupportMessage, SupportThread } from "@/types/database";

/**
 * POST /api/support/chat
 * { thread: "admin" | "seller", orderRef?, sellerName?, orderContext?, message }
 *
 * The customer's message is stored, then a reply is generated:
 *  - "admin"  → Gemini triage (classifies intent + suggests an action it can
 *               never itself perform). Mock fallback with no GEMINI_API_KEY.
 *  - "seller" → a simulated seller auto-reply (real seller messaging is a
 *               later phase; the customer's side persists for real).
 *
 * All DB writes degrade gracefully: if migration 0007 isn't applied yet the
 * reply still comes back (persisted:false) so the chat works in-session.
 */
export async function POST(req: Request) {
  let body: {
    thread?: SupportThread;
    orderRef?: string | null;
    sellerName?: string | null;
    orderContext?: { item: string; farm: string; status: string; total: number } | null;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const thread = body.thread;
  const message = (body.message ?? "").trim();
  if (thread !== "admin" && thread !== "seller") {
    return NextResponse.json({ error: "thread must be 'admin' or 'seller'" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orderRef = body.orderRef ?? null;

  // Prior turns for context (best-effort; empty if the table isn't there yet).
  let history: SupportTurn[] = [];
  try {
    let q = supabase
      .from("support_messages")
      .select("sender, body, created_at")
      .eq("user_id", user.id)
      .eq("thread", thread)
      .order("created_at", { ascending: true })
      .limit(12);
    q = orderRef ? q.eq("order_ref", orderRef) : q.is("order_ref", null);
    const { data } = await q;
    history = (data ?? []).map((r) => ({
      role: (r as Pick<SupportMessage, "sender">).sender === "customer" ? "customer" : "ai",
      text: (r as Pick<SupportMessage, "body">).body,
    }));
  } catch {
    /* table missing — continue without history */
  }

  let persisted = true;
  const insert = async (row: {
    sender: SupportMessage["sender"];
    body: string;
    intent?: string | null;
  }) => {
    try {
      // Customers may only post as themselves (RLS, 0010); the simulated
      // seller reply and the AI answer are written by the server.
      const db = row.sender === "customer" ? supabase : createAdminClient();
      const { error } = await db.from("support_messages").insert({
        user_id: user.id,
        thread,
        order_ref: orderRef,
        seller_name: body.sellerName ?? null,
        sender: row.sender,
        body: row.body,
        intent: row.intent ?? null,
      });
      if (error) persisted = false;
    } catch {
      persisted = false;
    }
  };

  await insert({ sender: "customer", body: message });

  // Generate the reply.
  if (thread === "seller") {
    const reply = sellerAutoReply(message, body.orderContext ?? null);
    await insert({ sender: "seller", body: reply });
    return NextResponse.json({ sender: "seller", reply, persisted });
  }

  let triage: SupportReply;
  try {
    triage = await geminiSupportTriage({
      message,
      order: body.orderContext ?? null,
      history,
    });
  } catch {
    triage = mockSupportTriage(message);
  }
  await insert({ sender: "ai", body: triage.reply, intent: triage.intent });

  return NextResponse.json({
    sender: "ai",
    reply: triage.reply,
    intent: triage.intent,
    suggestedAction: triage.suggestedAction,
    persisted,
  });
}

/** Simulated seller reply — warm, acknowledges, sets a rough expectation. */
function sellerAutoReply(
  message: string,
  order: { item: string; farm: string } | null
): string {
  const m = message.toLowerCase();
  const who = order ? order.farm : "the farm";
  if (/late|where|deliver|arriv/.test(m)) {
    return `Thanks for checking in — this is ${who}. Your order is on the way; deliveries usually arrive within the day. I'll update you if anything changes. 🌱`;
  }
  if (/damaged|rotten|bad|spoiled|refund|wrong/.test(m)) {
    return `So sorry to hear that! Please send a photo and I'll make it right — a replacement or a refund request are both fine with me.`;
  }
  return `Hi, thanks for reaching out to ${who}! Happy to help with your order — what would you like to know?`;
}
