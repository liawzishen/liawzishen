const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

/** What the customer's message is about. */
export type SupportIntent =
  | "refund"
  | "damaged"
  | "delivery"
  | "quality"
  | "question"
  | "other";

/** What the assistant can offer the shopper to do next. It only ever
 *  SUGGESTS — opening a request is the shopper's click, approval is a human's. */
export type SuggestedAction = "refund" | "return" | "contact_seller" | "none";

export interface SupportTurn {
  role: "customer" | "ai";
  text: string;
}

export interface SupportContext {
  message: string;
  order?: { item: string; farm: string; status: string; total: number } | null;
  history: SupportTurn[];
}

export interface SupportReply {
  intent: SupportIntent;
  reply: string;
  suggestedAction: SuggestedAction;
}

const INTENTS: SupportIntent[] = [
  "refund",
  "damaged",
  "delivery",
  "quality",
  "question",
  "other",
];
const ACTIONS: SuggestedAction[] = ["refund", "return", "contact_seller", "none"];

/**
 * Gemini Text — the customer-service admin assistant. Classifies the shopper's
 * issue and replies helpfully, but is explicitly powerless: it cannot approve
 * refunds or change orders, only advise and suggest opening a request a human
 * will review. Throws on missing key / HTTP error (caller falls back to mock).
 */
export async function geminiSupportTriage(
  ctx: SupportContext
): Promise<SupportReply> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const prompt = `You are the GreenMap customer-service admin assistant for a Malaysian fresh-produce marketplace. A shopper needs help.

RULES:
- You CANNOT approve refunds, move money, or change order status. Never promise a refund will be granted.
- You may only advise and, when it fits, suggest the shopper OPEN a request that a human seller/admin will review.
- Reply warmly in 1-3 short plain-text sentences. No markdown.

Classify the issue and choose at most one action to suggest.
Return ONLY compact JSON, no code fences:
{"intent": one of ["refund","damaged","delivery","quality","question","other"], "reply": string, "suggestedAction": one of ["refund","return","contact_seller","none"]}

Order in question: ${
    ctx.order
      ? `${ctx.order.item} from ${ctx.order.farm}, status "${ctx.order.status}", total RM ${ctx.order.total}`
      : "not specified"
  }
Conversation so far:
${ctx.history.map((h) => `${h.role}: ${h.text}`).join("\n") || "(none)"}
Shopper: ${ctx.message}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini Text ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim())
    throw new Error("Gemini returned no text");

  // Defensive parse — strip any stray code fences, validate the enums.
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<SupportReply>;
  const intent = INTENTS.includes(parsed.intent as SupportIntent)
    ? (parsed.intent as SupportIntent)
    : "other";
  const suggestedAction = ACTIONS.includes(parsed.suggestedAction as SuggestedAction)
    ? (parsed.suggestedAction as SuggestedAction)
    : "none";
  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : "Thanks for reaching out — could you tell me a bit more about the problem?";

  return { intent, reply, suggestedAction };
}

/**
 * Keyword fallback used when GEMINI_API_KEY is absent (or Gemini errors). Same
 * shape and the same powerless behaviour — advise + suggest, never approve.
 */
export function mockSupportTriage(message: string): SupportReply {
  const m = message.toLowerCase();
  const has = (...w: string[]) => w.some((x) => m.includes(x));

  if (has("refund", "money back", "wrong", "not what", "cancel")) {
    return {
      intent: "refund",
      reply:
        "I'm sorry to hear that. I can't approve refunds myself, but I can help you open a refund request for a seller/admin to review. Want me to start one?",
      suggestedAction: "refund",
    };
  }
  if (has("damaged", "rotten", "spoiled", "bad", "moldy", "crushed", "broken")) {
    return {
      intent: "damaged",
      reply:
        "That shouldn't happen with fresh produce. A photo helps — you can open a return/refund request and the seller will review it.",
      suggestedAction: "return",
    };
  }
  if (has("late", "delivery", "not arrived", "where", "shipping", "deliver")) {
    return {
      intent: "delivery",
      reply:
        "Delivery is handled directly by the farm. I'd message the seller for the latest status — I can take you to that chat.",
      suggestedAction: "contact_seller",
    };
  }
  if (has("fresh", "quality", "taste", "small", "size")) {
    return {
      intent: "quality",
      reply:
        "Thanks for the feedback on quality — the seller will want to know. You can message them, and leaving a rating helps other shoppers too.",
      suggestedAction: "contact_seller",
    };
  }
  return {
    intent: "question",
    reply:
      "Happy to help! Could you tell me a little more — is this about a refund, a delivery, or the quality of an order? (Demo assistant — set GEMINI_API_KEY for full AI answers.)",
    suggestedAction: "none",
  };
}
