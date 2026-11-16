import type { createAdminClient } from "@/lib/supabase/admin";
import type { NewFarm } from "./validate";

type Admin = ReturnType<typeof createAdminClient>;

/*
 * Writing farm data. The browser cannot write these tables (migration
 * 0011); the API routes call these functions with the service-role client
 * AFTER checking the request (guardRequest, a parser from ./validate, and an
 * ownership check from ./ownership). Nothing here checks who is calling.
 */

/** The GPS columns come from migration 0006, which a project may not have yet. */
const missingPinColumn = (message: string) => /latitude|longitude/i.test(message);

/**
 * Create a farm with its zones, for `userId`. All or nothing: if the zones
 * cannot be saved the farm is removed again, so a grower is never left with
 * half a farm. Returns the new farm's id.
 */
export async function createFarm(admin: Admin, userId: string, farm: NewFarm): Promise<string> {
  const row = {
    user_id: userId,
    name: farm.name,
    location: farm.location,
    size: farm.size,
    crop_type: farm.cropType,
    background_type: farm.backgroundType,
    background_url: farm.backgroundUrl,
  };

  let { data, error } = await admin
    .from("farms")
    .insert(farm.pin ? { ...row, ...farm.pin } : row)
    .select("id")
    .single();
  if (error && farm.pin && missingPinColumn(error.message)) {
    // Weather then falls back to the state's coordinates.
    ({ data, error } = await admin.from("farms").insert(row).select("id").single());
  }
  if (error || !data) throw error ?? new Error("farm insert returned no row");
  const farmId = (data as { id: string }).id;

  if (farm.zones.length > 0) {
    const { error: zoneError } = await admin
      .from("zones")
      .insert(farm.zones.map((zone) => ({ farm_id: farmId, ...zone })));
    if (zoneError) {
      await admin.from("farms").delete().eq("id", farmId);
      throw zoneError;
    }
  }
  return farmId;
}
