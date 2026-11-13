import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeResult } from "@/lib/ai/validate";
import { recalculatePlantScore } from "@/lib/health/recalculate";
import { isPublicStorageUrl } from "@/lib/storage/public-url";
import {
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  serverError,
  unauthorized,
} from "@/lib/api/http";

const SCOPE = "/api/ai/save-scan";

/**
 * POST /api/ai/save-scan  { plantId, imageUrl, result }
 * Grower-confirmed save. Rejects unanalysed (error) results, re-sanitises the
 * rest (ai_sub_score recomputed server-side from severity — never trusted),
 * inserts ai_analyses + an ai_scan log, then recalculates the score.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();

  const { plantId, imageUrl, result } = body;
  if (typeof plantId !== "string" || !plantId || !imageUrl || !result) {
    return jsonError("plantId, imageUrl and result are required", 400);
  }
  // Only photos from our own scan bucket may be attached to a plant record.
  if (!isPublicStorageUrl(imageUrl, "plant-scans")) {
    return jsonError("imageUrl must be a photo uploaded to GreenMap", 400);
  }

  if (
    typeof result === "object" &&
    (result as Record<string, unknown>).error === true
  ) {
    return jsonError("This scan couldn't be analysed, so it can't be saved.", 400);
  }

  const { data: plant } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .single();
  if (!plant) return jsonError("Plant not found", 404);

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
  if (aErr) return serverError(SCOPE, aErr, "Could not save the scan. Please try again.");

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
  if (lErr) return serverError(SCOPE, lErr, "Could not save the scan. Please try again.");

  try {
    const score = await recalculatePlantScore(admin, plantId);
    return NextResponse.json({ score });
  } catch (e) {
    return serverError(SCOPE, e, "The scan was saved, but the health score could not be updated.");
  }
}
