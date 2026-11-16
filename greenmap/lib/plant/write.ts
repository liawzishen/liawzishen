import type { createAdminClient } from "@/lib/supabase/admin";
import { recalculatePlantScore } from "@/lib/health/recalculate";
import type { ManualStatus, Plant } from "@/types/database";
import type { CareLog, NewPlant } from "./validate";

type Admin = ReturnType<typeof createAdminClient>;

/*
 * Writing plant data. Like lib/farm/write.ts: called by the API routes with
 * the service-role client, after the request and the owner are checked.
 */

/**
 * Add a plant to the map, with its "planted" entry in the care log.
 * A new plant has no health score yet (grey "New" marker, D4) — the score
 * appears with the first care event.
 */
export async function createPlant(admin: Admin, plant: NewPlant, today: string): Promise<Plant> {
  const { data, error } = await admin
    .from("plants")
    .insert({
      farm_id: plant.farmId,
      zone_id: plant.zoneId,
      name: plant.name,
      type: plant.type,
      // The database default is the UTC date, which is still "yesterday"
      // until 8 am in Malaysia.
      plant_date: today,
      expected_harvest_date: plant.expectedHarvestDate,
      position_x: plant.position.x,
      position_y: plant.position.y,
      health_score: null,
      manual_status: "attention",
      lifecycle_status: "active",
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("plant insert returned no row");
  const created = data as Plant;

  const { error: logError } = await admin.from("growth_logs").insert({
    plant_id: created.id,
    event_type: "planted",
    note: `Planted ${created.name}`,
    metadata: {},
  });
  // The plant exists and is usable; a missing timeline row is not fatal.
  if (logError) console.error("[plants] 'planted' log failed:", logError);

  return created;
}

/** Recalculate, but never fail the write that came before it. */
async function scoreAfterWrite(
  admin: Admin,
  plantId: string,
  manualStatus: ManualStatus
): Promise<number | null> {
  try {
    return await recalculatePlantScore(admin, plantId, manualStatus);
  } catch (cause) {
    console.error(`[health] recalculation failed for plant ${plantId}:`, cause);
    return null;
  }
}

/**
 * Save a care log and bring the health score up to date.
 * Returns the new score, or null if the log was saved but the score could
 * not be recalculated (it catches up with the next event).
 */
export async function addCareLog(
  admin: Admin,
  log: CareLog,
  manualStatus: ManualStatus
): Promise<number | null> {
  const { error } = await admin.from("growth_logs").insert({
    plant_id: log.plantId,
    event_type: log.eventType,
    note: log.note,
    metadata: log.metadata,
  });
  if (error) throw error;
  return scoreAfterWrite(admin, log.plantId, manualStatus);
}

/** Save the grower's own status for a plant and recalculate its score. */
export async function setManualStatus(
  admin: Admin,
  plantId: string,
  status: ManualStatus
): Promise<number | null> {
  const { error } = await admin
    .from("plants")
    .update({ manual_status: status })
    .eq("id", plantId);
  if (error) throw error;
  return scoreAfterWrite(admin, plantId, status);
}
