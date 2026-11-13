/**
 * Gemini REST client — the one place that talks to Google's Generative
 * Language API (`generateContent`). Vision, text tips and support triage all
 * call `geminiGenerate`, so the model, timeout and error handling live here.
 */

/**
 * Default model. Google listed `gemini-2.0-flash` (the old default) for
 * shutdown from 1 June 2026 and names `gemini-3.6-flash` as its replacement;
 * it accepts image input. Override with GEMINI_MODEL.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/** A slow model call must not hold a request open forever. */
const REQUEST_TIMEOUT_MS = 25_000;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask for a JSON reply (`responseMimeType: application/json`). */
  json?: boolean;
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiModel(): string {
  // `||`, not `??`: .env.example ships an empty `GEMINI_MODEL=`, which `??` keeps.
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

/** The answer text of a generateContent response, without "thought" parts. */
export function extractGeminiText(data: unknown): string {
  const parts = (
    data as {
      candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[];
    }
  )?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => p && p.thought !== true && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

async function post(key: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: "POST",
    // The key travels in a header, not the URL, so it never lands in logs.
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
}

/**
 * Call Gemini and return the reply text. Throws on a missing key, a network
 * or HTTP error, a timeout, or an empty reply — callers fall back to their
 * labelled sample output.
 *
 * Thinking is kept low: these are short, simple tasks, and thinking tokens
 * count against `maxOutputTokens`. Models older than Gemini 3 reject
 * `thinkingLevel`, so that one error is retried without it.
 */
export async function geminiGenerate(
  parts: GeminiPart[],
  opts: GeminiOptions = {}
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const generationConfig: Record<string, unknown> = {};
  if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature;
  if (opts.maxOutputTokens !== undefined) {
    generationConfig.maxOutputTokens = opts.maxOutputTokens;
  }
  if (opts.json) generationConfig.responseMimeType = "application/json";

  const request = (config: Record<string, unknown>) =>
    post(key, { contents: [{ parts }], generationConfig: config });

  let res = await request({
    ...generationConfig,
    thinkingConfig: { thinkingLevel: "LOW" },
  });
  if (res.status === 400) {
    const detail = await res.text();
    if (!/thinking/i.test(detail)) {
      throw new Error(`Gemini 400: ${detail.slice(0, 300)}`);
    }
    res = await request(generationConfig);
  }

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const text = extractGeminiText(await res.json());
  if (!text) throw new Error("Gemini returned no text");
  return text;
}
