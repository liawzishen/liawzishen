import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { geminiSuggest } from "@/lib/ai/gemini-text";
import { daysSince } from "@/lib/health/calculate";
import { guardRequest } from "@/lib/api/guard";
import { cleanText, isUuid, jsonError } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";

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
 * for 60 minutes; this route is never counted as a scan. Mock when no key,
 * and the general tip when the caller is over the rate limit.
 */
export async function POST(req: Request) {
  // No limit in the guard: a limited caller still gets a (general) tip below.
  const guard = await guardRequest(req, { limit: null });
  if (!guard.ok) return guard.response;
  const { supabase, user, body } = guard;

  const plantId = body.plantId;
  if (!isUuid(plantId)) return jsonError("plantId is required", 400);

  const { data: plant } = await supabase
    .from("plants")
    .select("type, plant_date, health_score")
    .eq("id", plantId)
    .single();
  if (!plant) return jsonError("Plant not found", 404);
  const row = plant as { type: string; plant_date: string; health_score: number | null };
  // The crop name is the grower's own text and goes into the AI prompt, so
  // it is cut to one short line first.
  const p = { ...row, type: cleanText(row.type, 60) };

  if (!hasGeminiKey()) {
    return NextResponse.json({
      suggestion: mockSuggestion(p.type, p.health_score),
      mock: true,
    });
  }

  // Each tailored tip is a paid AI call. Past the limit the plant page still
  // gets an answer — the general tip — instead of an error.
  if ((await rateLimit(user.id, LIMITS.suggest)) > 0) {
    return NextResponse.json({
      suggestion: mockSuggestion(p.type, p.health_score, "ai-failed"),
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
