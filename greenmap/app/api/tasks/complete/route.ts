import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateManyPlantScores } from "@/lib/health/recalculate";
import { ownedPlantIds } from "@/lib/farm/ownership";
import {
  cleanIdList,
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  serverError,
  unauthorized,
} from "@/lib/api/http";

/** Upper bound for one batch ("Water All" on a very large farm). */
const MAX_PLANTS_PER_REQUEST = 1000;

/**
 * POST /api/tasks/complete  { action: "water" | "fertilize", plantIds: string[] }
 *
 * Marks one or many care tasks done by logging the real care event for each
 * owned plant, then recalculating its score. Powers both the per-card checkbox
 * (one id) and the "Water All / Fertilize All" batch buttons (many ids).
 */
export async function POST(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();

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
  // No note: the event_type already says "watered"/"fertilized", and feeds
  // render the label — a note repeating it read as "Watered Watered".
  const rows = ownedIds.map((id) => ({
    plant_id: id,
    event_type: action,
    note: null,
    metadata: {},
  }));
  const { error: insErr } = await admin.from("growth_logs").insert(rows);
  if (insErr) {
    return serverError("/api/tasks/complete", insErr, "Could not save the task. Please try again.");
  }

  // Best-effort and parallel; the logs are saved regardless.
  await recalculateManyPlantScores(admin, ownedIds);

  return NextResponse.json({ ok: true, completed: ownedIds });
}
