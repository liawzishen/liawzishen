import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/supabase/chunked";
import type { ManualStatus } from "@/types/database";

/*
 * "Is this yours?" — answered by the database, not by this code.
 *
 * Every function here takes the caller's own client (Row Level Security on).
 * RLS only returns the caller's rows, so a row that comes back IS theirs and
 * a row that does not is "not found" — whether it does not exist or belongs
 * to someone else. The server routes ask this first, and only then write
 * with the service-role client. The ownership rule itself lives in one
 * place: the SELECT policies in supabase/migrations.
 */

/** The farm, if the signed-in user owns it. */
export async function getOwnedFarm(
  supabase: SupabaseClient,
  farmId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("farms")
    .select("id")
    .eq("id", farmId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string } | null;
}

export interface OwnedPlant {
  id: string;
  farm_id: string;
  manual_status: ManualStatus;
}

/** The plant, if it stands on one of the signed-in user's farms. */
export async function getOwnedPlant(
  supabase: SupabaseClient,
  plantId: string
): Promise<OwnedPlant | null> {
  const { data, error } = await supabase
    .from("plants")
    .select("id, farm_id, manual_status")
    .eq("id", plantId)
    .maybeSingle();
  if (error) throw error;
  return data as OwnedPlant | null;
}

/** True when the zone belongs to this farm (and the farm to the user). */
export async function zoneIsOnFarm(
  supabase: SupabaseClient,
  zoneId: string,
  farmId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("zones")
    .select("id")
    .eq("id", zoneId)
    .eq("farm_id", farmId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Which of `plantIds` the signed-in user owns. Pass the RLS-scoped client:
 * Row Level Security only returns the caller's own plants, so anything that
 * comes back is theirs.
 */
export async function ownedPlantIds(
  supabase: SupabaseClient,
  plantIds: string[]
): Promise<string[]> {
  const rows = await selectInChunks<{ id: string }>(plantIds, (part) =>
    supabase.from("plants").select("id").in("id", part)
  );
  return rows.map((row) => row.id);
}
