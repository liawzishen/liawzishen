import type { FertilizerSummary } from "@/types/database";

/**
 * Pure aggregation for a Harvest Passport snapshot (docs/03 §8). No DB calls —
 * the route fetches the rows and passes them in. Badge rules:
 *   pesticide_free = no log has metadata.pesticide_used = true
 *   organic        = no fertilize log has metadata.fertilizer_category = 'chemical'
 *   ai_verified    = at least one AI scan
 */
export interface PassportAggregate {
  grow_days: number;
  avg_health: number;
  ai_scan_count: number;
  fertilizer_summary: FertilizerSummary;
  pesticide_free: boolean;
  organic: boolean;
  ai_verified: boolean;
}

export function aggregatePassport(input: {
  plantDate: string;
  harvestDate: string;
  logs: { event_type: string; metadata: Record<string, unknown> | null }[];
  analysisCount: number;
  scores: number[];
}): PassportAggregate {
  const grow_days = Math.max(
    0,
    Math.round(
      (new Date(input.harvestDate).getTime() - new Date(input.plantDate).getTime()) /
        86_400_000
    )
  );

  const avg_health = input.scores.length
    ? Math.round(input.scores.reduce((a, b) => a + b, 0) / input.scores.length)
    : 0;

  const types = new Set<string>();
  let fertCount = 0;
  let organic = true;
  let pesticideFree = true;

  for (const l of input.logs) {
    const md = (l.metadata ?? {}) as Record<string, unknown>;
    if (l.event_type === "fertilize") {
      fertCount += 1;
      if (typeof md.fertilizer_type === "string" && md.fertilizer_type.trim()) {
        types.add(md.fertilizer_type.trim());
      }
      if (md.fertilizer_category === "chemical") organic = false;
    }
    if (md.pesticide_used === true) pesticideFree = false;
  }

  return {
    grow_days,
    avg_health,
    ai_scan_count: input.analysisCount,
    fertilizer_summary: { types: [...types], count: fertCount },
    pesticide_free: pesticideFree,
    organic,
    ai_verified: input.analysisCount >= 1,
  };
}
