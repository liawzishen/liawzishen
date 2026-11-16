import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedPlant } from "@/lib/farm/ownership";
import { parseManualStatus } from "@/lib/plant/validate";
import { setManualStatus } from "@/lib/plant/write";
import { guardRequest } from "@/lib/api/guard";
import { jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

/**
 * POST /api/plants/status  { plantId, status: "healthy" | "attention" | "critical" }
 *
 * Saves the grower's own judgement of a plant (15% of the health score) and
 * recalculates the score. Returns `{ score }`.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const input = parseManualStatus(body);
  if (!input.ok) return jsonError(input.error, 400);
  const { plantId, status } = input.value;

  try {
    const plant = await getOwnedPlant(supabase, plantId);
    if (!plant) return jsonError("Plant not found", 404);

    const score = await setManualStatus(createAdminClient(), plantId, status);
    return NextResponse.json({ score });
  } catch (e) {
    return serverError("/api/plants/status", e, "Could not save the status. Please try again.");
  }
}
