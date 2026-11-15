import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateManyPlantScores } from "@/lib/health/recalculate";
import { ownedPlantIds } from "@/lib/farm/ownership";
import { ID_FILTER_CHUNK } from "@/lib/supabase/chunked";
import { chunk } from "@/lib/utils";
import { guardRequest } from "@/lib/api/guard";
import { cleanIdList, jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/tasks/uncomplete";

/** Upper bound for one batch (undoing "Water All" on a very large farm). */
const MAX_PLANTS_PER_REQUEST = 1000;

/**
 * POST /api/tasks/uncomplete  { action: "water" | "fertilize", plantIds: string[] }
 *
 * Undo a completed care task: deletes the most recent matching care log for
 * each owned plant (the one the complete action just created) and recalculates
 * the score. Powers the "uncheck" in the Completed Today tray.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const action = body.action;
  if (action !== "water" && action !== "fertilize") {
    return jsonError("action must be water or fertilize", 400);
  }
  if (Array.isArray(body.plantIds) && body.plantIds.length > MAX_PLANTS_PER_REQUEST) {
    return jsonError(`At most ${MAX_PLANTS_PER_REQUEST} plants per request`, 400);
  }
  const plantIds = cleanIdList(body.plantIds, MAX_PLANTS_PER_REQUEST);
  if (plantIds.length === 0) return jsonError("plantIds required", 400);

  const ownedIds = await ownedPlantIds(supabase, plantIds);
  if (ownedIds.length === 0) return jsonError("No matching plants", 404);

  const admin = createAdminClient();

  // Newest matching log per plant — the one the complete action just created.
  const latestId = new Map<string, string>();
  for (const ids of chunk(ownedIds, ID_FILTER_CHUNK)) {
    const { data: logs, error } = await admin
      .from("growth_logs")
      .select("id, plant_id, created_at")
      .in("plant_id", ids)
      .eq("event_type", action)
      .order("created_at", { ascending: false });
    if (error) {
      return serverError(SCOPE, error, "Could not undo the task. Please try again.");
    }
    for (const l of logs ?? []) {
      if (!latestId.has(l.plant_id)) latestId.set(l.plant_id, l.id);
    }
  }

  for (const ids of chunk([...latestId.values()], ID_FILTER_CHUNK)) {
    const { error } = await admin.from("growth_logs").delete().in("id", ids);
    if (error) {
      return serverError(SCOPE, error, "Could not undo the task. Please try again.");
    }
  }

  await recalculateManyPlantScores(admin, latestId.keys());

  return NextResponse.json({ ok: true });
}
