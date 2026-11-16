import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedPlant } from "@/lib/farm/ownership";
import { parseCareLog } from "@/lib/plant/validate";
import { addCareLog } from "@/lib/plant/write";
import { guardRequest } from "@/lib/api/guard";
import { jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

/**
 * POST /api/plants/log
 *   { plantId, type: "water" }                      + method?
 *   { plantId, type: "fertilize" }                  + fertilizerType?, category?, amount?, pesticideUsed?
 *   { plantId, type: "note", text }                 + pesticideUsed?, pesticideType?
 *
 * Saves one care event for a plant the caller owns and recalculates its
 * health score — one request where the app used to make two. Returns
 * `{ score }` (null if the log was saved but the score could not be updated).
 *
 * "ai_scan" and "harvested" entries are not accepted here: they are written
 * by /api/ai/save-scan and /api/passports/generate.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const log = parseCareLog(body);
  if (!log.ok) return jsonError(log.error, 400);

  try {
    const plant = await getOwnedPlant(supabase, log.value.plantId);
    if (!plant) return jsonError("Plant not found", 404);

    const score = await addCareLog(createAdminClient(), log.value, plant.manual_status);
    return NextResponse.json({ score });
  } catch (e) {
    return serverError("/api/plants/log", e, "Could not save the log. Please try again.");
  }
}
