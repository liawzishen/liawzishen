import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/user";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";
import { liveDisplayScore } from "@/lib/health/calculate";
import { lastCareForPlant } from "@/lib/health/live";
import type { AiAnalysis, GrowthLog, Plant, Zone } from "@/types/database";

/*
 * Everything the plant pages read from the database.
 *
 * Pages do not build queries themselves: they call one loader and render
 * what comes back. Each loader runs its queries in ONE parallel round trip
 * (they are all keyed by the plant id) and is wrapped in React `cache()`.
 * RLS returns a plant only to its owner, so "not found" and "not yours" are
 * the same answer: null.
 */

/** One point of the 7-day trend chart. */
export interface HealthPoint {
  score: number;
  created_at: string;
}

export interface PlantDetail {
  plant: Plant;
  zone: Zone | null;
  /** Live (passively decayed) score; null = "New". */
  liveScore: number | null;
  history: HealthPoint[];
  /** The 5 newest logs. */
  recentLogs: GrowthLog[];
  /** The 10 newest scans, newest first. */
  analyses: AiAnalysis[];
}

/** How many days of history the plant page's trend chart shows. */
const TREND_DAYS = 7;

/** The plant detail page. */
export const getPlantDetail = cache(
  async (farmId: string, plantId: string): Promise<PlantDetail | null> => {
    const supabase = await createClient();
    const since = new Date(Date.now() - TREND_DAYS * 86_400_000).toISOString();

    const [
      { data: plant },
      { data: zones },
      care,
      { data: history },
      { data: logs },
      { data: analyses },
    ] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).single(),
      // Zones are keyed by the farm id from the URL, so the plant's zone does
      // not need a second round trip.
      supabase.from("zones").select("*").eq("farm_id", farmId),
      lastCareForPlant(supabase, plantId),
      supabase
        .from("health_score_history")
        .select("score, created_at")
        .eq("plant_id", plantId)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      supabase
        .from("growth_logs")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("ai_analyses")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (!plant) return null;

    const p = plant as Plant;
    const analysisRows = (analyses ?? []) as AiAnalysis[];

    return {
      plant: p,
      zone: ((zones ?? []) as Zone[]).find((z) => z.id === p.zone_id) ?? null,
      // The same pure formula and the same inputs as the farm map: newest
      // scan (the list is newest-first), newest water, newest fertilize.
      liveScore: liveDisplayScore(p.health_score, {
        aiSubScore: analysisRows[0]?.ai_sub_score ?? null,
        lastWaterAt: care.lastWaterAt,
        lastFertilizeAt: care.lastFertilizeAt,
        manualStatus: p.manual_status,
      }),
      history: (history ?? []) as HealthPoint[],
      recentLogs: (logs ?? []) as GrowthLog[],
      analyses: analysisRows,
    };
  }
);

export interface PlantActivity {
  name: string;
  logs: GrowthLog[];
  analyses: AiAnalysis[];
}

/** The full activity page: every log and scan of one plant, newest first. */
export const getPlantActivity = cache(
  async (plantId: string): Promise<PlantActivity | null> => {
    const supabase = await createClient();
    const [{ data: plant }, { data: logs }, { data: analyses }] =
      await Promise.all([
        supabase.from("plants").select("name").eq("id", plantId).single(),
        supabase
          .from("growth_logs")
          .select("*")
          .eq("plant_id", plantId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_analyses")
          .select("*")
          .eq("plant_id", plantId)
          .order("created_at", { ascending: false }),
      ]);
    if (!plant) return null;
    return {
      name: (plant as { name: string }).name,
      logs: (logs ?? []) as GrowthLog[],
      analyses: (analyses ?? []) as AiAnalysis[],
    };
  }
);

export interface PlantHarvestState {
  id: string;
  name: string;
  harvested: boolean;
  /** The QR token of its passport, once it has one. */
  passportToken: string | null;
}

/** The harvest page: is the plant harvested, and where is its passport? */
export const getPlantHarvestState = cache(
  async (plantId: string): Promise<PlantHarvestState | null> => {
    const supabase = await createClient();
    const [{ data: plant }, { data: passport }] = await Promise.all([
      supabase
        .from("plants")
        .select("id, name, lifecycle_status")
        .eq("id", plantId)
        .single(),
      supabase
        .from("harvest_passports")
        .select("qr_token")
        .eq("plant_id", plantId)
        .maybeSingle(),
    ]);
    if (!plant) return null;
    const p = plant as { id: string; name: string; lifecycle_status: string };
    return {
      id: p.id,
      name: p.name,
      harvested: p.lifecycle_status === "harvested",
      passportToken:
        (passport as { qr_token: string | null } | null)?.qr_token ?? null,
    };
  }
);

export interface PlantScanContext {
  name: string;
  type: string;
  /** The signed-in user's scan credits (null when signed out). */
  allowance: ScanAllowance | null;
}

/** The per-plant AI scan page: the plant and the user's scan credits. */
export const getPlantScanContext = cache(
  async (plantId: string): Promise<PlantScanContext | null> => {
    const supabase = await createClient();
    // The plant does not wait for the user check; the allowance starts as
    // soon as the user id is known.
    const [{ data: plant }, allowance] = await Promise.all([
      supabase.from("plants").select("name, type").eq("id", plantId).single(),
      getAuthUser().then((user) =>
        user ? getScanAllowance(supabase, user.id) : null
      ),
    ]);
    if (!plant) return null;
    const p = plant as { name: string; type: string };
    return { name: p.name, type: p.type, allowance };
  }
);
