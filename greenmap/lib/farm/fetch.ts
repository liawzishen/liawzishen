import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { liveHealthForPlants, type LiveHealth } from "@/lib/health/live";
import type { Farm, GrowthLog, Plant, Zone } from "@/types/database";

/**
 * Load a farm with its zones and plants. Returns null if not found/owned.
 *
 * Each plant's `health_score` is replaced with its LIVE display score (passive
 * decay) so the map markers and KPI counts reflect the current state without
 * writing. The stored value in the DB is untouched. `care` carries the
 * last-water/last-fertilize timestamps already fetched for that calculation,
 * so pages that build care tasks don't re-query growth_logs.
 *
 * Farm, zones and plants load in one parallel round trip — RLS scopes every
 * query to the owner, so a foreign farmId simply comes back empty.
 */
export async function getFarmBundle(farmId: string): Promise<{
  farm: Farm;
  zones: Zone[];
  plants: Plant[];
  care: Pick<LiveHealth, "lastWater" | "lastFertilize">;
} | null> {
  const supabase = await createClient();

  const [{ data: farm }, { data: zones }, { data: plants }] = await Promise.all(
    [
      supabase.from("farms").select("*").eq("id", farmId).single(),
      supabase.from("zones").select("*").eq("farm_id", farmId),
      supabase
        .from("plants")
        .select("*")
        .eq("farm_id", farmId)
        .order("created_at", { ascending: true }),
    ]
  );
  if (!farm) return null;

  const plantRows = (plants ?? []) as Plant[];
  const live = await liveHealthForPlants(supabase, plantRows);
  const plantsWithLive = plantRows.map((p) => ({
    ...p,
    health_score: live.scores.get(p.id) ?? p.health_score,
  }));

  return {
    farm: farm as Farm,
    zones: (zones ?? []) as Zone[],
    plants: plantsWithLive,
    care: { lastWater: live.lastWater, lastFertilize: live.lastFertilize },
  };
}

/** One point of the farm-wide average health trend (one row per day). */
export interface FarmHealthPoint {
  date: string; // YYYY-MM-DD
  avg: number; // 0–100, averaged across all snapshots that day
}

/**
 * Analysis data for the desktop map dashboard: the farm's latest activity
 * (all plants, newest first) and a 14-day farm-wide average health trend
 * built from health_score_history snapshots. Two parallel queries; both
 * degrade to empty arrays on error so the dashboard never blocks the map.
 */
export async function getFarmAnalytics(plantIds: string[]): Promise<{
  logs: GrowthLog[];
  healthTrend: FarmHealthPoint[];
}> {
  if (plantIds.length === 0) return { logs: [], healthTrend: [] };
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [{ data: logs }, { data: history }] = await Promise.all([
    supabase
      .from("growth_logs")
      .select("*")
      .in("plant_id", plantIds)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("health_score_history")
      .select("score, created_at")
      .in("plant_id", plantIds)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true }),
  ]);

  // Collapse snapshots into one average per calendar day.
  const byDay = new Map<string, { total: number; n: number }>();
  for (const row of (history ?? []) as { score: number; created_at: string }[]) {
    const date = row.created_at.slice(0, 10);
    const acc = byDay.get(date) ?? { total: 0, n: 0 };
    acc.total += row.score;
    acc.n += 1;
    byDay.set(date, acc);
  }
  const healthTrend = [...byDay.entries()]
    .map(([date, { total, n }]) => ({ date, avg: Math.round(total / n) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return { logs: (logs ?? []) as GrowthLog[], healthTrend };
}

/**
 * Current user plus their farms (newest first) for the header FarmSwitcher.
 * One helper so tab pages can run it in parallel with getFarmBundle.
 */
export async function getUserAndFarms(): Promise<{
  user: User | null;
  farms: { id: string; name: string }[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, farms: [] };

  const { data } = await supabase
    .from("farms")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return { user, farms: (data ?? []) as { id: string; name: string }[] };
}
