import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  extractGeminiText,
  geminiGenerate,
  geminiModel,
  hasGeminiKey,
} from "./gemini";

const okReply = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("geminiModel", () => {
  it("falls back to the default when GEMINI_MODEL is unset or empty", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    expect(geminiModel()).toBe(DEFAULT_GEMINI_MODEL);
  });

  it("uses GEMINI_MODEL when it is set", () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-custom");
    expect(geminiModel()).toBe("gemini-custom");
  });
});

describe("extractGeminiText", () => {
  it("joins answer parts and skips thought parts", () => {
    const data = {
      candidates: [
        {
          content: {
            parts: [
              { text: "thinking…", thought: true },
              { text: "Hello " },
              { text: "farmer" },
            ],
          },
        },
      ],
    };
    expect(extractGeminiText(data)).toBe("Hello farmer");
  });

  it("returns an empty string for an unexpected shape", () => {
    expect(extractGeminiText(null)).toBe("");
    expect(extractGeminiText({ candidates: [] })).toBe("");
    expect(extractGeminiText({ candidates: [{ finishReason: "MAX_TOKENS" }] })).toBe("");
  });
});

describe("geminiGenerate", () => {
  it("throws without a key and never calls the network", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(hasGeminiKey()).toBe(false);
    await expect(geminiGenerate([{ text: "hi" }])).rejects.toThrow(/GEMINI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the key in a header, never in the URL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    vi.stubEnv("GEMINI_MODEL", "");
    const fetchMock = vi.fn(async () => okReply(" Water today. "));
    vi.stubGlobal("fetch", fetchMock);

    await expect(geminiGenerate([{ text: "hi" }], { json: true })).resolves.toBe(
      "Water today."
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
  });

  it("retries without thinkingConfig when an older model rejects it", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"error":{"message":"Thinking level is not supported"}}', { status: 400 })
      )
      .mockResolvedValueOnce(okReply("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(geminiGenerate([{ text: "hi" }])).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(second.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("does not retry other 400 errors", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const fetchMock = vi.fn(async () => new Response("bad image", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(geminiGenerate([{ text: "hi" }])).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws on an HTTP error and on an empty reply", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    await expect(geminiGenerate([{ text: "hi" }])).rejects.toThrow(/404/);

    vi.stubGlobal("fetch", vi.fn(async () => okReply("   ")));
    await expect(geminiGenerate([{ text: "hi" }])).rejects.toThrow(/no text/);
  });
});
