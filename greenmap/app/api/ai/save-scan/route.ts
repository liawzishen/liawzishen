import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyScan } from "@/lib/ai/receipt";
import { sanitizeResult } from "@/lib/ai/validate";
import { recalculatePlantScore } from "@/lib/health/recalculate";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { guardRequest } from "@/lib/api/guard";
import { isUuid, jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/ai/save-scan";
const SAVE_FAILED = "Could not save the scan. Please try again.";

/** Postgres unique-violation: this scan is already saved (see 0010). */
const UNIQUE_VIOLATION = "23505";

/**
 * POST /api/ai/save-scan  { plantId, imageUrl, result, receipt }
 * Grower-confirmed save of a scan that /api/ai/scan produced.
 *
 * The result travels through the browser, so it is not trusted: it must match
 * the `receipt` the scan route signed for this user, plant and photo
 * (lib/ai/receipt.ts). A result typed in by hand — "Healthy, 100% sure" —
 * has no valid receipt and is refused, which keeps "AI verified" on the
 * Harvest Passport true.
 *
 * Saving the same scan twice (double tap, replayed request) stores it once.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, user, body } = guard;

  const { plantId, result, receipt } = body;
  if (!isUuid(plantId) || !body.imageUrl || !result) {
    return jsonError("plantId, imageUrl and result are required", 400);
  }
  // Only photos from our own scan bucket may be attached to a plant record.
  const imageUrl = publicStorageUrl(body.imageUrl, "plant-scans")?.href;
  if (!imageUrl) {
    return jsonError("imageUrl must be a photo uploaded to GreenMap", 400);
  }

  if (
    typeof result === "object" &&
    (result as Record<string, unknown>).error === true
  ) {
    return jsonError("This scan couldn't be analysed, so it can't be saved.", 400);
  }
  if (!verifyScan({ userId: user.id, plantId, imageUrl, result }, receipt)) {
    return jsonError(
      "This scan result could not be verified. Please scan the plant again.",
      400,
      { code: "invalid_receipt" }
    );
  }

  const { data: plant } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .single();
  if (!plant) return jsonError("Plant not found", 404);

  const clean = sanitizeResult(result);
  const admin = createAdminClient();

  // Already saved? Then there is nothing to add — answer with the score.
  const { data: existing, error: findErr } = await admin
    .from("ai_analyses")
    .select("id")
    .eq("plant_id", plantId)
    .eq("image_url", imageUrl)
    .limit(1);
  if (findErr) return serverError(SCOPE, findErr, SAVE_FAILED);

  if (!existing || existing.length === 0) {
    const { error: aErr } = await admin.from("ai_analyses").insert({
      plant_id: plantId,
      image_url: imageUrl,
      diagnosis: clean.diagnosis,
      confidence: clean.confidence,
      severity: clean.severity,
      ai_sub_score: clean.ai_sub_score,
      recommendations: clean.recommendations,
    });
    // A unique violation means a second request saved it a moment ago.
    if (aErr && aErr.code !== UNIQUE_VIOLATION) {
      return serverError(SCOPE, aErr, SAVE_FAILED);
    }

    if (!aErr) {
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
      if (lErr) return serverError(SCOPE, lErr, SAVE_FAILED);
    }
  }

  try {
    const score = await recalculatePlantScore(admin, plantId);
    return NextResponse.json({ score });
  } catch (e) {
    return serverError(SCOPE, e, "The scan was saved, but the health score could not be updated.");
  }
}
