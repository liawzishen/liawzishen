import { describe, expect, it } from "vitest";
import { groupSupportThreads } from "./queries";
import type { SupportMessage } from "@/types/database";

function message(
  userId: string,
  orderRef: string | null,
  createdAt: string,
  body = "hi"
): SupportMessage {
  return {
    user_id: userId,
    order_ref: orderRef,
    created_at: createdAt,
    body,
    sender: "customer",
    thread: "seller",
  } as SupportMessage;
}

describe("groupSupportThreads", () => {
  it("makes one conversation per customer and order", () => {
    const threads = groupSupportThreads([
      message("u1", "A1", "2026-11-01T08:00:00Z"),
      message("u2", "A1", "2026-11-01T09:00:00Z"),
      message("u1", "A1", "2026-11-01T10:00:00Z"),
      message("u1", "B2", "2026-11-01T11:00:00Z"),
    ]);
    expect(threads.map((t) => t.length).sort()).toEqual([1, 1, 2]);
  });

  it("keeps a customer's general chat apart from their order chats", () => {
    const threads = groupSupportThreads([
      message("u1", null, "2026-11-01T08:00:00Z"),
      message("u1", "A1", "2026-11-01T09:00:00Z"),
    ]);
    expect(threads).toHaveLength(2);
  });

  it("puts the most recently active conversation first", () => {
    const threads = groupSupportThreads([
      message("old", "A1", "2026-11-01T08:00:00Z"),
      message("new", "B2", "2026-11-02T08:00:00Z"),
      message("old", "A1", "2026-11-03T08:00:00Z", "latest"),
    ]);
    expect(threads[0][0].user_id).toBe("old");
    expect(threads[0].at(-1)?.body).toBe("latest");
    expect(threads[1][0].user_id).toBe("new");
  });

  it("keeps the messages of a conversation in the order given", () => {
    const [thread] = groupSupportThreads([
      message("u1", "A1", "2026-11-01T08:00:00Z", "first"),
      message("u1", "A1", "2026-11-01T09:00:00Z", "second"),
    ]);
    expect(thread.map((m) => m.body)).toEqual(["first", "second"]);
  });

  it("is empty when there are no messages", () => {
    expect(groupSupportThreads([])).toEqual([]);
  });
});
