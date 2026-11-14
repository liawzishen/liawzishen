import { createClient } from "@/lib/supabase/server";
import { selectInChunks } from "@/lib/supabase/chunked";
import { liveDisplayScore } from "./calculate";
import type { Plant } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type CareLogRow = { plant_id: string; event_type: string; created_at: string };
type ScanRow = { plant_id: string; ai_sub_score: number; created_at: string };

export type LiveHealth = {
  /** plant id → live display score (null = "New", per D4). */
  scores: Map<string, number | null>;
  /** plant id → ISO timestamp of the most recent water log. */
  lastWater: Map<string, string>;
  /** plant id → ISO timestamp of the most recent fertilize log. */
  lastFertilize: Map<string, string>;
};

/**
 * Compute each plant's LIVE display score (passive decay) WITHOUT writing,
 * plus the last-care timestamps the score is derived from — so callers that
 * also need "last watered / fertilized" (e.g. the Home task list) reuse this
 * instead of re-querying growth_logs.
 *
 * Uses the same pure formula the server writes with (lib/health/calculate.ts),
 * so the map and the plant detail page always agree. Plants whose stored score
 * is still null stay null ("New", per D4 — we never invent a number for them).
 * Batched: two queries per 100 plants, never one per plant.
 */
export async function liveHealthForPlants(
  supabase: ServerClient,
  plants: Plant[]
): Promise<LiveHealth> {
  const scores = new Map<string, number | null>();
  const lastWater = new Map<string, string>();
  const lastFertilize = new Map<string, string>();
  if (plants.length === 0) return { scores, lastWater, lastFertilize };
  const ids = plants.map((p) => p.id);

  // Chunked by plant id (see selectInChunks). Each plant sits in exactly one
  // chunk and every chunk is newest-first, so "first row seen" below is still
  // that plant's most recent event.
  const [logs, scans] = await Promise.all([
    selectInChunks<CareLogRow>(ids, (part) =>
      supabase
        .from("growth_logs")
        .select("plant_id, event_type, created_at")
        .in("plant_id", part)
        .in("event_type", ["water", "fertilize"])
        .order("created_at", { ascending: false })
    ),
    selectInChunks<ScanRow>(ids, (part) =>
      supabase
        .from("ai_analyses")
        .select("plant_id, ai_sub_score, created_at")
        .in("plant_id", part)
        .order("created_at", { ascending: false })
    ),
  ]);

  for (const l of logs) {
    if (l.event_type === "water" && !lastWater.has(l.plant_id)) {
      lastWater.set(l.plant_id, l.created_at);
    } else if (l.event_type === "fertilize" && !lastFertilize.has(l.plant_id)) {
      lastFertilize.set(l.plant_id, l.created_at);
    }
  }

  const lastAi = new Map<string, number>();
  for (const s of scans) {
    if (!lastAi.has(s.plant_id)) lastAi.set(s.plant_id, s.ai_sub_score);
  }

  const now = new Date();
  for (const p of plants) {
    scores.set(
      p.id,
      liveDisplayScore(p.health_score, {
        aiSubScore: lastAi.get(p.id) ?? null,
        lastWaterAt: lastWater.get(p.id) ?? null,
        lastFertilizeAt: lastFertilize.get(p.id) ?? null,
        manualStatus: p.manual_status,
        now,
      })
    );
  }
  return { scores, lastWater, lastFertilize };
}

/**
 * The most recent water and fertilize log of ONE plant. Two `limit(1)`
 * queries — the plant page needs only the newest of each, not every care log
 * the plant ever had. Feed the result to `liveDisplayScore` (same formula
 * the map uses, so the two always agree).
 */
export async function lastCareForPlant(
  supabase: ServerClient,
  plantId: string
): Promise<{ lastWaterAt: string | null; lastFertilizeAt: string | null }> {
  const latest = async (eventType: "water" | "fertilize") => {
    const { data } = await supabase
      .from("growth_logs")
      .select("created_at")
      .eq("plant_id", plantId)
      .eq("event_type", eventType)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as { created_at: string } | undefined;
    return row?.created_at ?? null;
  };
  const [lastWaterAt, lastFertilizeAt] = await Promise.all([
    latest("water"),
    latest("fertilize"),
  ]);
  return { lastWaterAt, lastFertilizeAt };
}
