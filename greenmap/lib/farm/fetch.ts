import { createClient } from "@/lib/supabase/server";
import { liveScoresForPlants } from "@/lib/health/live";
import type { Farm, Plant, Zone } from "@/types/database";

/**
 * Load a farm with its zones and plants. Returns null if not found/owned.
 *
 * Each plant's `health_score` is replaced with its LIVE display score (passive
 * decay) so the map markers and KPI counts reflect the current state without
 * writing. The stored value in the DB is untouched.
 */
export async function getFarmBundle(farmId: string): Promise<{
  farm: Farm;
  zones: Zone[];
  plants: Plant[];
} | null> {
  const supabase = await createClient();

  const { data: farm } = await supabase
    .from("farms")
    .select("*")
    .eq("id", farmId)
    .single();
  if (!farm) return null;

  const [{ data: zones }, { data: plants }] = await Promise.all([
    supabase.from("zones").select("*").eq("farm_id", farmId),
    supabase
      .from("plants")
      .select("*")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: true }),
  ]);

  const plantRows = (plants ?? []) as Plant[];
  const live = await liveScoresForPlants(supabase, plantRows);
  const plantsWithLive = plantRows.map((p) => ({
    ...p,
    health_score: live.get(p.id) ?? p.health_score,
  }));

  return {
    farm: farm as Farm,
    zones: (zones ?? []) as Zone[],
    plants: plantsWithLive,
  };
}
