import { describe, expect, it, vi } from "vitest";
import { postJson } from "./client";

const reply = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("postJson", () => {
  it("sends JSON and returns the data on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { farm: { id: "f1" } }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await postJson("/api/farms", { name: "Ladang" })).toEqual({ ok: true, data: { farm: { id: "f1" } } });
    expect(fetchMock).toHaveBeenCalledWith("/api/farms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Ladang"}',
    });
  });

  it("returns the server's message and status on an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(429, { error: "Too many requests.", code: "rate_limited" })));
    expect(await postJson("/api/plants", {})).toEqual({ ok: false, status: 429, error: "Too many requests." });
  });

  it("has a message of its own when the server sent none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(502, "<html>Bad gateway</html>")));
    const result = await postJson("/api/plants", {});
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(!result.ok && result.error).toMatch(/Something went wrong/);
  });

  it("never throws when there is no connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await postJson("/api/plants", {});
    expect(result).toMatchObject({ ok: false, status: 0 });
    expect(!result.ok && result.error).toMatch(/No connection/);
  });
});
