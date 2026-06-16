const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

function endpoint(key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}

function prompt(cropType: string, strict: boolean): string {
  const base = `You are an expert plant pathologist. Analyse this photo of a ${cropType || "crop"} leaf/plant and reply with ONLY a JSON object in exactly this shape:
{"diagnosis":"<one or two short sentences naming the condition, or 'Healthy'>","severity":"none|mild|moderate|severe","confidence":<integer 0-100>,"recommendations":["<short actionable step>","..."]}
Rules: severity "none" = healthy; choose the closest severity; give 2 to 4 short, farmer-friendly recommendations.`;
  return strict
    ? base + "\nReturn ONLY valid JSON. No markdown, no text before or after the JSON."
    : base;
}

export interface VisionInput {
  imageBase64: string;
  mimeType: string;
  cropType: string;
}

/**
 * Call Gemini Vision and return the raw text reply (the caller parses it).
 * Throws on a missing key or an HTTP/network error. `strict` tightens the
 * prompt for the one retry after a parse failure.
 */
export async function geminiVision(
  input: VisionInput,
  opts: { strict?: boolean } = {}
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(endpoint(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt(input.cropType, opts.strict ?? false) },
            { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) throw new Error(`Gemini Vision ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  return text;
}
