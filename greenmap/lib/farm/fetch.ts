import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, type AuthUser } from "@/lib/auth/user";
import { liveHealthForPlants, type LiveHealth } from "@/lib/health/live";
import { selectInChunks } from "@/lib/supabase/chunked";
import { getFarmWeather, type WeatherBundle } from "@/lib/weather/fetch";
import { localDateISO } from "@/lib/date";
import type { EventType, Farm, Plant, Zone } from "@/types/database";

/*
 * Loading rules for farm pages (they decide how fast a tab opens):
 *
 *   1. Every loader here is wrapped in React `cache()`. A page, its layout
 *      and its streamed sections can all ask for the same data and it is
 *      fetched once per request.
 *   2. Queries that do not depend on each other run in the same round trip.
 *      A page costs "waves" of round trips, so the goal is few waves:
 *        wave 1  farm + zones + plants        (loadFarmCore)
 *        wave 2  everything keyed by plant id (live health, activity, trend)
 *   3. Slow or optional data (weather, the desktop trend chart) is streamed
 *      with <Suspense> by the page, so it never blocks the first paint.
 */

/**
 * Wave 1 — the farm row, its zones and its plants (stored scores), in one
 * parallel round trip. RLS scopes every query to the owner, so a foreign
 * farmId simply comes back empty.
 */
const loadFarmCore = cache(async (farmId: string) => {
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
  return {
    farm: farm as Farm,
    zones: (zones ?? []) as Zone[],
    plants: (plants ?? []) as Plant[],
  };
});

/**
 * Load a farm with its zones and plants. Returns null if not found/owned.
 *
 * Each plant's `health_score` is replaced with its LIVE display score (passive
 * decay) so the map markers and KPI counts reflect the current state without
 * writing. The stored value in the DB is untouched. `care` carries the
 * last-water/last-fertilize timestamps already fetched for that calculation,
 * so pages that build care tasks don't re-query growth_logs.
 */
export const getFarmBundle = cache(
  async (
    farmId: string
  ): Promise<{
    farm: Farm;
    zones: Zone[];
    plants: Plant[];
    care: Pick<LiveHealth, "lastWater" | "lastFertilize">;
  } | null> => {
    const core = await loadFarmCore(farmId);
    if (!core) return null;

    const supabase = await createClient();
    const live = await liveHealthForPlants(supabase, core.plants);
    const plantsWithLive = core.plants.map((p) => ({
      ...p,
      health_score: live.scores.get(p.id) ?? p.health_score,
    }));

    return {
      farm: core.farm,
      zones: core.zones,
      plants: plantsWithLive,
      care: { lastWater: live.lastWater, lastFertilize: live.lastFertilize },
    };
  }
);

/** One row of the Home "Recent activity" feed. */
export interface ActivityRow {
  plant_id: string;
  event_type: EventType;
  note: string | null;
  created_at: string;
}

/**
 * The newest growth logs across the farm's ACTIVE plants, newest first.
 * Runs in the same wave as the live-health queries of `getFarmBundle` (both
 * only wait for the plant list), so the feed adds no extra round trip.
 */
export const getFarmActivity = cache(
  async (farmId: string, limit: number): Promise<ActivityRow[]> => {
    const core = await loadFarmCore(farmId);
    if (!core) return [];
    const activeIds = core.plants
      .filter((p) => p.lifecycle_status === "active")
      .map((p) => p.id);

    const supabase = await createClient();
    const rows = await selectInChunks<ActivityRow>(activeIds, (part) =>
      supabase
        .from("growth_logs")
        .select("plant_id, event_type, note, created_at")
        .in("plant_id", part)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
    // Each chunk is already newest-first; merge them into one newest-first feed.
    return rows
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }
);

/**
 * The farm's weather (Open-Meteo), or null when the farm is not found/owned.
 * It starts as soon as the farm row is known — it does not wait for the
 * plant queries — and pages stream it with <Suspense>, so a slow forecast
 * can never hold back the rest of the page.
 */
export const getWeatherForFarm = cache(
  async (farmId: string): Promise<WeatherBundle | null> => {
    const core = await loadFarmCore(farmId);
    return core ? getFarmWeather(core.farm) : null;
  }
);

/**
 * Start loading data that a <Suspense> section will read later, without
 * waiting for it. Because the loaders are cached per request, the section
 * then receives the same promise — so its data loads WHILE the page awaits
 * its own, not after. Errors are left for the section that awaits it.
 */
export function preload(...pending: Promise<unknown>[]): void {
  for (const p of pending) p.catch(() => {});
}

/** One point of the farm-wide average health trend (one row per day). */
export interface FarmHealthPoint {
  date: string; // YYYY-MM-DD
  avg: number; // 0–100, averaged across all snapshots that day
}

/**
 * Analysis data for the desktop map dashboard: a 14-day farm-wide average
 * health trend built from health_score_history snapshots. (The activity
 * feed lives on Home — the Map tab deliberately doesn't repeat it.)
 * Degrades to an empty array on error so the dashboard never blocks the map.
 * The Map page streams this with <Suspense>; it shares the plant list with
 * `getFarmBundle` instead of loading it again.
 */
export const getFarmHealthTrend = cache(
  async (farmId: string): Promise<FarmHealthPoint[]> => {
    const core = await loadFarmCore(farmId);
    const plantIds = core?.plants.map((p) => p.id) ?? [];
    if (plantIds.length === 0) return [];
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const history = await selectInChunks<{ score: number; created_at: string }>(
      plantIds,
      (part) =>
        supabase
          .from("health_score_history")
          .select("score, created_at")
          .in("plant_id", part)
          .gte("created_at", since.toISOString())
    );

    // Collapse snapshots into one average per calendar day.
    const byDay = new Map<string, { total: number; n: number }>();
    for (const row of history) {
      const date = localDateISO(new Date(row.created_at)); // the farm's day, not UTC's
      const acc = byDay.get(date) ?? { total: 0, n: 0 };
      acc.total += row.score;
      acc.n += 1;
      byDay.set(date, acc);
    }
    return [...byDay.entries()]
      .map(([date, { total, n }]) => ({ date, avg: Math.round(total / n) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
);

/**
 * Current user plus their farms (newest first) for the header FarmSwitcher.
 * One helper so tab pages can run it in parallel with getFarmBundle.
 */
export const getUserAndFarms = cache(
  async (): Promise<{
    user: AuthUser | null;
    farms: { id: string; name: string }[];
  }> => {
    const user = await getAuthUser();
    if (!user) return { user: null, farms: [] };

    const supabase = await createClient();
    const { data } = await supabase
      .from("farms")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return { user, farms: (data ?? []) as { id: string; name: string }[] };
  }
);

/** Farm id → how many rows belong to it. */
export function countByFarm(
  rows: readonly { farm_id: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.farm_id] = (counts[row.farm_id] ?? 0) + 1;
  return counts;
}

export interface FarmList {
  user: AuthUser | null;
  /** The signed-in grower's farms, newest first. */
  farms: Farm[];
}

/**
 * The signed-in grower and their farms. The user check and the farm list
 * run together (RLS limits the rows to this user's own farms).
 */
export const getFarmList = cache(async (): Promise<FarmList> => {
  const supabase = await createClient();
  const [user, { data }] = await Promise.all([
    getAuthUser(),
    supabase.from("farms").select("*").order("created_at", { ascending: false }),
  ]);
  return { user, farms: (data ?? []) as Farm[] };
});

/**
 * Farm id → number of ACTIVE plants, in one query. Harvested plants are not
 * counted, so the number matches the "Plants" stat inside the farm.
 * Separate from `getFarmList` on purpose: the farm chooser usually redirects
 * (zero or one farm) and must not pay for counts it will not show.
 */
export async function getActivePlantCounts(
  farmIds: string[]
): Promise<Record<string, number>> {
  if (farmIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("plants")
    .select("farm_id")
    .eq("lifecycle_status", "active")
    .in("farm_id", farmIds);
  return countByFarm((data ?? []) as { farm_id: string }[]);
}
