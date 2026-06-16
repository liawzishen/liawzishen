import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeResult } from "@/lib/ai/validate";
import { recalculatePlantScore } from "@/lib/health/recalculate";

/**
 * POST /api/ai/save-scan  { plantId, imageUrl, result }
 * Grower-confirmed save. Rejects unanalysed (error) results, re-sanitises the
 * rest (ai_sub_score recomputed server-side from severity — never trusted),
 * inserts ai_analyses + an ai_scan log, then recalculates the score.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { plantId?: string; imageUrl?: string; result?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { plantId, imageUrl, result } = body;
  if (!plantId || !imageUrl || !result) {
    return NextResponse.json(
      { error: "plantId, imageUrl and result are required" },
      { status: 400 }
    );
  }

  if (
    typeof result === "object" &&
    (result as Record<string, unknown>).error === true
  ) {
    return NextResponse.json(
      { error: "This scan couldn't be analysed, so it can't be saved." },
      { status: 400 }
    );
  }

  const { data: plant } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .single();
  if (!plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  const clean = sanitizeResult(result);
  const admin = createAdminClient();

  const { error: aErr } = await admin.from("ai_analyses").insert({
    plant_id: plantId,
    image_url: imageUrl,
    diagnosis: clean.diagnosis,
    confidence: clean.confidence,
    severity: clean.severity,
    ai_sub_score: clean.ai_sub_score,
    recommendations: clean.recommendations,
  });
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  const { error: lErr } = await admin.from("growth_logs").insert({
    plant_id: plantId,
    event_type: "ai_scan",
    note: clean.diagnosis,
    metadata: {
      diagnosis: clean.diagnosis,
      severity: clean.severity,
      confidence: clean.confidence,
    },
  });
  if (lErr) {
    return NextResponse.json({ error: lErr.message }, { status: 500 });
  }

  try {
    const score = await recalculatePlantScore(admin, plantId);
    return NextResponse.json({ score });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recalculation failed" },
      { status: 500 }
    );
  }
}
