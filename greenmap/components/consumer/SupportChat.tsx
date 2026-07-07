"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupportSender, SupportThread } from "@/types/database";
import type { SuggestedAction } from "@/lib/ai/gemini-support";

/**
 * Shared support chat — used for both the AI admin thread and the (simulated)
 * seller thread. Sends to /api/support/chat and renders the reply. For the
 * admin thread, an AI suggestion may add an action chip that LINKS the shopper
 * to where a human completes it (open a refund, message the seller) — the AI
 * itself never performs the action.
 */

type Msg = {
  sender: SupportSender;
  body: string;
  suggestedAction?: SuggestedAction;
};

const QUICK_ADMIN = [
  "My order arrived damaged",
  "I want a refund",
  "Where is my delivery?",
];

export function SupportChat({
  thread,
  orderRef = null,
  sellerName = null,
  orderContext = null,
  initialMessages,
}: {
  thread: SupportThread;
  orderRef?: string | null;
  sellerName?: string | null;
  orderContext?: { item: string; farm: string; status: string; total: number } | null;
  initialMessages: Msg[];
}) {
  const greeting: Msg =
    thread === "admin"
      ? {
          sender: "ai",
          body:
            "Hi! I'm the GreenMap assistant. Tell me what's wrong with your order and I'll point you the right way. I can't approve refunds myself, but I can help you open a request.",
        }
      : {
          sender: "seller",
          body: `Hi! You're chatting with ${sellerName ?? "the seller"}. How can I help with your order?`,
        };

  const [messages, setMessages] = useState<Msg[]>(
    initialMessages.length > 0 ? initialMessages : [greeting]
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const body = text.trim();
    if (!body || sending) return;
    setInput("");
    setMessages((m) => [...m, { sender: "customer", body }]);
    setSending(true);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread, orderRef, sellerName, orderContext, message: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "failed");
      setMessages((m) => [
        ...m,
        {
          sender: data.sender as SupportSender,
          body: data.reply as string,
          suggestedAction: data.suggestedAction as SuggestedAction | undefined,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { sender: "ai", body: "Sorry, I couldn't send that just now. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-3 px-5 pb-40 pt-4">
        {messages.map((m, i) => (
          <div key={i}>
            <Bubble sender={m.sender}>{m.body}</Bubble>
            {m.suggestedAction && m.suggestedAction !== "none" && (
              <ActionChip action={m.suggestedAction} orderRef={orderRef} />
            )}
          </div>
        ))}
        {sending && (
          <Bubble sender={thread === "admin" ? "ai" : "seller"}>
            <span className="inline-flex gap-1">
              <Dot /> <Dot /> <Dot />
            </span>
          </Bubble>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 glass-strong px-4 pb-5 pt-3">
        {messages.length <= 1 && thread === "admin" && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_ADMIN.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-medium text-label shadow-card active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="h-11 flex-1 rounded-full bg-white/80 px-4 text-[15px] outline-none ring-1 ring-tertiary/40 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white transition active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ sender, children }: { sender: SupportSender; children: React.ReactNode }) {
  const mine = sender === "customer";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
          mine
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md glass text-label"
        }`}
      >
        {!mine && (
          <span className="mb-0.5 block text-[11px] font-semibold text-secondary">
            {sender === "ai" ? "🤖 GreenMap Admin" : "🧑‍🌾 Seller"}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

function ActionChip({
  action,
  orderRef,
}: {
  action: SuggestedAction;
  orderRef: string | null;
}) {
  if (action === "contact_seller") {
    const href = orderRef ? `/consumer/support/seller?order=${orderRef}` : "/consumer/orders";
    return <Chip href={href}>💬 Message the seller →</Chip>;
  }
  // refund / return both resolve at the order's support hub, where a human
  // (the shopper) opens the request the seller reviews.
  const href = orderRef ? `/consumer/orders/${orderRef}` : "/consumer/orders";
  return (
    <Chip href={href}>
      {action === "return" ? "↩️ Start a return request →" : "💸 Open a refund request →"}
    </Chip>
  );
}

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-1.5 ml-1 inline-flex items-center rounded-full bg-brand/12 px-3 py-1.5 text-[13px] font-semibold text-brand-dark active:scale-95"
    >
      {children}
    </Link>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />;
}
