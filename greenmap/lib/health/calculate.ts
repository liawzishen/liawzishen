/**
 * Health-score ENGINE — the deterministic formula, as a pure function.
 *
 * One source of truth, used in two places (docs/01 §5, docs/03 §4):
 *   - SERVER (writes): POST /api/health/recalculate runs this after each
 *     scoring event, then writes plants.health_score + a
 *     health_score_history snapshot.
 *   - CLIENT (display only): Plant Detail + Farm Map recompute on load so the
 *     shown number reflects passive decay. Never written back — which is why
 *     the map and the detail page always agree.
 *
 * No DB calls and no value imports (only a type). Pass inputs in, get a
 * number out — so it is trivially testable and identical on both sides.
 *
 *   score = round(ai×0.40 + watering×0.25 + fertilizer×0.20 + manual×0.15)
 *   watering   = max(0, 100 − daysSinceWater × 10)      (never watered → 0)
 *   fertilizer = max(0, 100 − daysSinceFertilize × 8)   (never fertilized → 0)
 *   ai         = latest ai_analyses.ai_sub_score        (no scan → 50)
 *   manual     = healthy 100 · attention 50 · critical 0
 */

import type { ManualStatus } from "@/types/database";

/** Formula weights (must sum to 1). Locked by docs/03 §4. */
export const HEALTH_WEIGHTS = {
  ai: 0.4,
  watering: 0.25,
  fertilizer: 0.2,
  manual: 0.15,
} as const;

/** Decay per day, in sub-score points. */
export const WATERING_DECAY_PER_DAY = 10;
export const FERTILIZER_DECAY_PER_DAY = 8;

/** Used when a plant has never been scanned. */
export const DEFAULT_AI_SUBSCORE = 50;

const MANUAL_SUBSCORE: Record<ManualStatus, number> = {
  healthy: 100,
  attention: 50,
  critical: 0,
};

export interface HealthInputs {
  /** Latest `ai_analyses.ai_sub_score`, or null if never scanned. */
  aiSubScore: number | null;
  /** ISO timestamp of the most recent `water` log, or null if never watered. */
  lastWaterAt: string | null;
  /** ISO timestamp of the most recent `fertilize` log, or null if never fertilized. */
  lastFertilizeAt: string | null;
  /** Current grower-set status (plants.manual_status). */
  manualStatus: ManualStatus;
  /** Injectable clock for tests / deterministic display. Defaults to now. */
  now?: Date;
}

/** Whole days elapsed from `from` to `now` (never negative). */
export function daysSince(from: string | Date, now: Date = new Date()): number {
  const f = typeof from === "string" ? new Date(from) : from;
  const ms = now.getTime() - f.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function wateringSubScore(
  lastWaterAt: string | null,
  now: Date = new Date()
): number {
  if (!lastWaterAt) return 0; // never watered
  return Math.max(0, 100 - daysSince(lastWaterAt, now) * WATERING_DECAY_PER_DAY);
}

export function fertilizerSubScore(
  lastFertilizeAt: string | null,
  now: Date = new Date()
): number {
  if (!lastFertilizeAt) return 0; // never fertilized
  return Math.max(
    0,
    100 - daysSince(lastFertilizeAt, now) * FERTILIZER_DECAY_PER_DAY
  );
}

export function manualSubScore(status: ManualStatus): number {
  return MANUAL_SUBSCORE[status] ?? MANUAL_SUBSCORE.attention;
}

/** The deterministic 40/25/20/15 score, clamped to 0–100. */
export function calculateHealthScore(inputs: HealthInputs): number {
  const now = inputs.now ?? new Date();
  const ai = inputs.aiSubScore ?? DEFAULT_AI_SUBSCORE;
  const watering = wateringSubScore(inputs.lastWaterAt, now);
  const fertilizer = fertilizerSubScore(inputs.lastFertilizeAt, now);
  const manual = manualSubScore(inputs.manualStatus);

  const raw =
    ai * HEALTH_WEIGHTS.ai +
    watering * HEALTH_WEIGHTS.watering +
    fertilizer * HEALTH_WEIGHTS.fertilizer +
    manual * HEALTH_WEIGHTS.manual;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Display helper that preserves the D4 "New" state: a plant whose stored
 * `health_score` is still NULL (no scoring event has ever fired) keeps showing
 * "New" — we never invent a live number for it. Every other plant gets the
 * live, passively-decayed score.
 */
export function liveDisplayScore(
  storedScore: number | null,
  inputs: HealthInputs
): number | null {
  if (storedScore === null) return null;
  return calculateHealthScore(inputs);
}
