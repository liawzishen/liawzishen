/**
 * Health-score DISPLAY logic — the single source for turning a score into a
 * colour, label and status icon. Used by plant markers (map), the plant
 * bottom sheet, and the plant detail page so they can never disagree.
 * Thresholds locked by docs/03_BACKEND_TRUTH.md §3.
 *
 *   70–100 → green  "Healthy"    ✓
 *   40–69  → amber  "Attention"  !
 *    0–39  → red    "Critical"   ✕
 *   null   → grey   "New"        +   (no scoring event yet — D4)
 *
 * High-contrast band colours PLUS an icon mean the UI never relies on colour
 * alone to convey a plant's status (accessibility — D10).
 */

export type HealthBand = "healthy" | "attention" | "critical" | "new";

export interface HealthDisplay {
  band: HealthBand;
  label: string;
  /** Hex for canvas (Konva needs literal colours, not CSS vars). */
  color: string;
  /** Monochrome status glyph — drawn on the marker, shown beside the label. */
  icon: string;
  /** Tailwind text class for DOM use. */
  textClass: string;
}

const HEALTHY: HealthDisplay = {
  band: "healthy",
  label: "Healthy",
  color: "#34C759",
  icon: "✓",
  textClass: "text-brand",
};
/*
 * `color` is the CANVAS fill — a marker blob on the map, where the bright
 * iOS hue reads well and only the 3:1 non-text floor applies. `textClass` is
 * the DOM label, which needs 4.5:1 and so uses the darkened ink token. The
 * two intentionally differ; keeping the bright hue in `textClass` was what
 * put "Attention" on screen at 1.86:1.
 */
const ATTENTION: HealthDisplay = {
  band: "attention",
  label: "Attention",
  color: "#FF9F0A",
  icon: "!",
  textClass: "text-warning-ink",
};
const CRITICAL: HealthDisplay = {
  band: "critical",
  label: "Critical",
  color: "#FF3B30",
  icon: "✕",
  textClass: "text-critical-ink",
};
const NEW: HealthDisplay = {
  band: "new",
  label: "New",
  color: "#C7C7CC",
  icon: "+",
  textClass: "text-secondary",
};

export function healthDisplay(score: number | null): HealthDisplay {
  if (score === null || score === undefined) return NEW;
  if (score >= 70) return HEALTHY;
  if (score >= 40) return ATTENTION;
  return CRITICAL;
}
