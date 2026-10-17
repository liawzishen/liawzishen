// `||`, not `??`: .env.example ships an empty `GEMINI_MODEL=`, which `??` keeps.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export interface SuggestContext {
  cropType: string;
  daysSincePlanted: number;
  daysSinceWater: number | null;
  daysSinceFertilize: number | null;
  lastDiagnosis: string | null;
  healthScore: number | null;
}

/**
 * Gemini Text — one or two practical sentences on the next best action for a
 * plant. Throws on missing key / HTTP error (caller falls back).
 */
export async function geminiSuggest(ctx: SuggestContext): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const prompt = `You are an agronomy assistant for a Malaysian smallholder farmer. In 1-2 short, practical sentences, give the single most useful next action for this plant. Be specific and encouraging. No markdown.
Crop: ${ctx.cropType}
Days since planted: ${ctx.daysSincePlanted}
Days since watered: ${ctx.daysSinceWater ?? "never"}
Days since fertilized: ${ctx.daysSinceFertilize ?? "never"}
Latest AI diagnosis: ${ctx.lastDiagnosis ?? "none"}
Current health score: ${ctx.healthScore ?? "not yet scored"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 160 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini Text ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) throw new Error("Gemini returned no text");
  return text.trim();
}
