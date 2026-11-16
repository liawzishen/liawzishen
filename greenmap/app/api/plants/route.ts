import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDateISO } from "@/lib/date";
import { MAX_PLANTS_PER_FARM } from "@/lib/farm/options";
import { getOwnedFarm, zoneIsOnFarm } from "@/lib/farm/ownership";
import { parseNewPlant } from "@/lib/plant/validate";
import { createPlant } from "@/lib/plant/write";
import { guardRequest } from "@/lib/api/guard";
import { jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/plants";
const FAILED = "Could not add the plant. Please try again.";

/**
 * POST /api/plants  { farmId, zoneId?, name, type, expectedHarvestDate?, position: { x, y } }
 *
 * Adds a plant to one of the caller's farms, with its "planted" log entry.
 * Returns the plant row so the map can show it at once.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const today = localDateISO();
  const plant = parseNewPlant(body, today);
  if (!plant.ok) return jsonError(plant.error, 400);
  const { farmId, zoneId } = plant.value;

  try {
    // The three questions do not depend on each other: one round trip.
    const [farm, zoneOk, { count, error: countError }] = await Promise.all([
      getOwnedFarm(supabase, farmId),
      zoneId ? zoneIsOnFarm(supabase, zoneId, farmId) : true,
      supabase
        .from("plants")
        .select("id", { count: "exact", head: true })
        .eq("farm_id", farmId),
    ]);
    if (!farm) return jsonError("Farm not found", 404);
    if (!zoneOk) return jsonError("That zone is not on this farm.", 400);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_PLANTS_PER_FARM) {
      return jsonError(`A farm can have at most ${MAX_PLANTS_PER_FARM} plants.`, 409, {
        code: "plant_limit",
      });
    }

    const created = await createPlant(createAdminClient(), plant.value, today);
    return NextResponse.json({ plant: created }, { status: 201 });
  } catch (e) {
    return serverError(SCOPE, e, FAILED);
  }
}
