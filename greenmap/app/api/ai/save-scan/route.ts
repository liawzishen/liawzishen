import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeResult } from "@/lib/ai/validate";
import { recalculatePlantScore } from "@/lib/health/recalculate";
import { verifyScan } from "@/lib/ai/scan-token";

/**
 * POST /api/ai/save-scan  { plantId, scanToken }
 * Grower-confirmed save of a result /api/ai/scan produced: the photo and
 * result come from the signed scanToken, never from the request body.
 * Rejects unanalysed (error) results, re-sanitises the rest (ai_sub_score
 * recomputed server-side from severity), inserts ai_analyses + an ai_scan
 * log, then recalculates the score.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { plantId?: string; scanToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { plantId, scanToken } = body;
  if (!plantId || !scanToken) {
    return NextResponse.json(
      { error: "plantId and scanToken are required" },
      { status: 400 }
    );
  }

  const scan = verifyScan(scanToken, user.id, plantId);
  if (!scan) {
    return NextResponse.json(
      { error: "This scan can't be verified. Please scan the leaf again." },
      { status: 400 }
    );
  }
  const { imageUrl, result } = scan;

  if (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>).error === true
  ) {
    return NextResponse.json(
      { error: "This scan couldn't be analysed, so it can't be saved." },
      { status: 400 }
    );
  }

  const { data: plant } = await supabase
    .from("plants")
    .select("id, lifecycle_status")
    .eq("id", plantId)
    .single();
  if (!plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }
  // A harvested plant's record is frozen into its public passport.
  if (plant.lifecycle_status !== "active") {
    return NextResponse.json(
      { error: "This plant is already harvested." },
      { status: 409 }
    );
  }

  const clean = sanitizeResult(result);
  const admin = createAdminClient();

  // One saved analysis per photo: a token can't be replayed to stack scans.
  const { data: dup } = await admin
    .from("ai_analyses")
    .select("id")
    .eq("plant_id", plantId)
    .eq("image_url", imageUrl)
    .limit(1);
  if (dup && dup.length > 0) {
    return NextResponse.json(
      { error: "This scan is already saved." },
      { status: 409 }
    );
  }

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
