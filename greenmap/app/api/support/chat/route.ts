import { NextResponse } from "next/server";
import {
  geminiSupportTriage,
  mockSupportTriage,
  type SupportContext,
  type SupportTurn,
  type SupportReply,
} from "@/lib/ai/gemini-support";
import { hasGeminiKey } from "@/lib/ai/gemini";
import {
  cleanText,
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  unauthorized,
} from "@/lib/api/http";
import type { SupportMessage } from "@/types/database";

/** Longest chat message accepted (it is stored and sent to the AI model). */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * The order summary comes from the browser and is placed in the AI prompt, so
 * every field is reduced to a short single-line string / a real number.
 */
function cleanOrderContext(value: unknown): NonNullable<SupportContext["order"]> | null {
  if (value === null || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const total = typeof o.total === "number" && Number.isFinite(o.total) ? o.total : 0;
  return {
    item: cleanText(o.item, 120),
    farm: cleanText(o.farm, 120),
    status: cleanText(o.status, 40),
    total,
  };
}

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
  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();

  const thread = body.thread;
  if (thread !== "admin" && thread !== "seller") {
    return jsonError("thread must be 'admin' or 'seller'", 400);
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return jsonError("message is required", 400);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonError(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`, 400);
  }

  const orderRef = cleanText(body.orderRef, 64) || null;
  const sellerName = cleanText(body.sellerName, 120) || null;
  const orderContext = cleanOrderContext(body.orderContext);

  // Prior turns for context (best-effort; empty if the table isn't there yet).
  let history: SupportTurn[] = [];
  try {
    let q = supabase
      .from("support_messages")
      .select("sender, body, created_at")
      .eq("user_id", user.id)
      .eq("thread", thread)
      // Newest 12, then flipped back to chat order below.
      .order("created_at", { ascending: false })
      .limit(12);
    q = orderRef ? q.eq("order_ref", orderRef) : q.is("order_ref", null);
    const { data } = await q;
    history = (data ?? []).reverse().map((r) => ({
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
      const { error } = await supabase.from("support_messages").insert({
        user_id: user.id,
        thread,
        order_ref: orderRef,
        seller_name: sellerName,
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
    const reply = sellerAutoReply(message, orderContext);
    await insert({ sender: "seller", body: reply });
    return NextResponse.json({ sender: "seller", reply, persisted });
  }

  let triage: SupportReply;
  try {
    triage = await geminiSupportTriage({ message, order: orderContext, history });
  } catch (e) {
    // No key is the expected demo path; anything else is worth a log line.
    if (hasGeminiKey()) console.error("[/api/support/chat] Gemini failed:", e);
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
