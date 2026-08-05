"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupportSender } from "@/types/database";

/**
 * One customer message thread in the grower inbox, with an inline reply. The
 * reply inserts a support_messages row (sender = 'seller') into the customer's
 * thread — allowed by the 0008 seller-insert policy (grower owns the farm) —
 * so the shopper sees it on their side.
 */
export function SellerThread({
  customerId,
  orderRef,
  sellerName,
  messages: initial,
}: {
  customerId: string;
  orderRef: string | null;
  sellerName: string | null;
  messages: { sender: SupportSender; body: string }[];
}) {
  const [messages, setMessages] = useState(initial);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = reply.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("support_messages").insert({
      user_id: customerId,
      thread: "seller",
      order_ref: orderRef,
      seller_name: sellerName,
      sender: "seller",
      body,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessages((m) => [...m, { sender: "seller", body }]);
    setReply("");
  }

  return (
    <div className="rounded-card p-4 glass">
      <p className="mb-2 text-[12px] font-semibold text-secondary">
        {orderRef ? `Order #${orderRef}` : "General"}
      </p>
      <div className="space-y-1.5">
        {messages.map((m, i) => {
          const mine = m.sender === "seller";
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                  mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-fill text-label"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Reply to the customer…"
          className="h-10 flex-1 rounded-full bg-white/80 px-3.5 text-[14px] outline-none ring-1 ring-tertiary/40 focus:ring-brand"
        />
        <button
          type="button"
          onClick={send}
          disabled={!reply.trim() || busy}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition active:scale-95 disabled:opacity-40"
          aria-label="Send reply"
        >
          ↑
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-critical-ink">{error}</p>}
    </div>
  );
}
