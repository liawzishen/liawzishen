import { geminiGenerate } from "./gemini";

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
  const prompt = `You are an agronomy assistant for a Malaysian smallholder farmer. In 1-2 short, practical sentences, give the single most useful next action for this plant. Be specific and encouraging. No markdown.
Crop: ${ctx.cropType}
Days since planted: ${ctx.daysSincePlanted}
Days since watered: ${ctx.daysSinceWater ?? "never"}
Days since fertilized: ${ctx.daysSinceFertilize ?? "never"}
Latest AI diagnosis: ${ctx.lastDiagnosis ?? "none"}
Current health score: ${ctx.healthScore ?? "not yet scored"}`;

  // The cap leaves room for the model's (low) thinking as well as the answer.
  return geminiGenerate([{ text: prompt }], {
    temperature: 0.5,
    maxOutputTokens: 1024,
  });
}
