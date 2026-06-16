import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geminiSuggest } from "@/lib/ai/gemini-text";
import { daysSince } from "@/lib/health/calculate";

function mockSuggestion(cropType: string): string {
  return `Keep ${cropType || "your plant"} on a steady watering rhythm and check the underside of the leaves for pests. (Demo tip — set GEMINI_API_KEY for tailored AI advice.)`;
}

/**
 * POST /api/ai/suggest  { plantId }
 * Returns a 1-2 sentence next-action suggestion. The client session-caches it
 * for 60 minutes; this route is never counted as a scan. Mock when no key.
 */
export async function POST(req: Request) {
  let plantId: string | undefined;
  try {
    plantId = (await req.json())?.plantId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!plantId) {
    return NextResponse.json({ error: "plantId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: plant } = await supabase
    .from("plants")
    .select("type, plant_date, health_score")
    .eq("id", plantId)
    .single();
  if (!plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }
  const p = plant as { type: string; plant_date: string; health_score: number | null };

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ suggestion: mockSuggestion(p.type), mock: true });
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
  } catch {
    return NextResponse.json({ suggestion: mockSuggestion(p.type) });
  }
}
