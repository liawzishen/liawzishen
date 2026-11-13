import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculatePlantScore } from "@/lib/health/recalculate";
import {
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  serverError,
  unauthorized,
} from "@/lib/api/http";

/**
 * POST /api/health/recalculate  { plantId }
 * Verifies ownership, then recomputes + persists the score and a history
 * snapshot via the shared recalculatePlantScore() helper.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();
  const plantId = typeof body.plantId === "string" ? body.plantId : "";
  if (!plantId) return jsonError("plantId is required", 400);

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
