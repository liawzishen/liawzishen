import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { geminiSuggest } from "@/lib/ai/gemini-text";
import { daysSince } from "@/lib/health/calculate";
import {
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  unauthorized,
} from "@/lib/api/http";

/**
 * Keyless fallback tip. Tone follows the plant's health band so the advice
 * never contradicts the status shown beside it (a "Critical" plant getting a
 * cheery "keep it up!" read as a bug in user testing).
 */
function mockSuggestion(
  cropType: string,
  healthScore: number | null,
  reason: "no-key" | "ai-failed" = "no-key"
): string {
  const crop = cropType || "your plant";
  const demoNote =
    reason === "no-key"
      ? " (Demo tip — set GEMINI_API_KEY for tailored AI advice.)"
      : " (General tip — tailored AI advice is unavailable right now.)";
  if (healthScore === null) {
    return `Welcome ${crop} to the farm! Water it well today and log the first care events to start its health record.${demoNote}`;
  }
  if (healthScore < 40) {
    return `${crop} needs urgent care — water it now, check the leaves and stem closely, and consider running an AI scan to find the problem.${demoNote}`;
  }
  if (healthScore < 70) {
    return `${crop} is asking for attention — a good watering and a quick leaf check today should get it back on track.${demoNote}`;
  }
  return `Keep ${crop} on a steady watering rhythm and check the underside of the leaves for pests.${demoNote}`;
}

/**
 * POST /api/ai/suggest  { plantId }
 * Returns a 1-2 sentence next-action suggestion. The client session-caches it
 * for 60 minutes; this route is never counted as a scan. Mock when no key.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();
  const plantId = typeof body.plantId === "string" ? body.plantId : "";
  if (!plantId) return jsonError("plantId is required", 400);

  const { data: plant } = await supabase
    .from("plants")
    .select("type, plant_date, health_score")
    .eq("id", plantId)
    .single();
  if (!plant) return jsonError("Plant not found", 404);
  const p = plant as { type: string; plant_date: string; health_score: number | null };

  if (!hasGeminiKey()) {
    return NextResponse.json({
      suggestion: mockSuggestion(p.type, p.health_score),
      mock: true,
    });
  }

  const [{ data: water }, { data: fert }, { data: ai }] = await Promise.all([
    supabase
      .from("growth_logs")
      .select("created_at")
      .eq("plant_id", plantId)
      .eq("event_type", "water")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("growth_logs")
      .select("created_at")
      .eq("plant_id", plantId)
      .eq("event_type", "fertilize")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ai_analyses")
      .select("diagnosis")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  try {
    const suggestion = await geminiSuggest({
      cropType: p.type,
      daysSincePlanted: daysSince(p.plant_date),
      daysSinceWater: water?.created_at ? daysSince(water.created_at) : null,
      daysSinceFertilize: fert?.created_at ? daysSince(fert.created_at) : null,
      lastDiagnosis: ai?.diagnosis ?? null,
      healthScore: p.health_score,
    });
    return NextResponse.json({ suggestion });
  } catch (e) {
    console.error("[/api/ai/suggest] Gemini failed:", e);
    return NextResponse.json({
      suggestion: mockSuggestion(p.type, p.health_score, "ai-failed"),
    });
  }
}
