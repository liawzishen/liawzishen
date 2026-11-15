import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculatePlantScore } from "@/lib/health/recalculate";
import { guardRequest } from "@/lib/api/guard";
import { isUuid, jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

/**
 * POST /api/health/recalculate  { plantId }
 * Verifies ownership, then recomputes + persists the score and a history
 * snapshot via the shared recalculatePlantScore() helper.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const plantId = body.plantId;
  if (!isUuid(plantId)) return jsonError("plantId is required", 400);

  // Ownership: RLS only returns the caller's own plants.
  const { data: plant } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .single();
  if (!plant) return jsonError("Plant not found", 404);

  try {
    const score = await recalculatePlantScore(createAdminClient(), plantId);
    return NextResponse.json({ score });
  } catch (e) {
    return serverError(
      "/api/health/recalculate",
      e,
      "Could not update the health score. Please try again."
    );
  }
}
