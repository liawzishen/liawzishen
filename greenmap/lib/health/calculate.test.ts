import { describe, expect, it } from "vitest";
import {
  HEALTH_WEIGHTS,
  calculateHealthScore,
  daysSince,
  fertilizerSubScore,
  liveDisplayScore,
  manualSubScore,
  wateringSubScore,
} from "./calculate";

const NOW = new Date("2026-07-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("health score formula", () => {
  it("has weights that sum to 1", () => {
    const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("gives a perfect plant 100", () => {
    expect(
      calculateHealthScore({
        aiSubScore: 100,
        lastWaterAt: daysAgo(0),
        lastFertilizeAt: daysAgo(0),
        manualStatus: "healthy",
        now: NOW,
      })
    ).toBe(100);
  });

  it("gives a never-cared-for critical plant with a bad scan 0", () => {
    expect(
      calculateHealthScore({
        aiSubScore: 0,
        lastWaterAt: null,
        lastFertilizeAt: null,
        manualStatus: "critical",
        now: NOW,
      })
    ).toBe(0);
  });

  it("applies the 40/25/20/15 weights", () => {
    // ai 75×0.40 + water (100−2×10)×0.25 + fert (100−5×8)×0.20 + manual 50×0.15
    // = 30 + 20 + 12 + 7.5 = 69.5 → 70
    expect(
      calculateHealthScore({
        aiSubScore: 75,
        lastWaterAt: daysAgo(2),
        lastFertilizeAt: daysAgo(5),
        manualStatus: "attention",
        now: NOW,
      })
    ).toBe(70);
  });

  it("uses 50 for the AI part when the plant was never scanned", () => {
    const base = {
      lastWaterAt: daysAgo(0),
      lastFertilizeAt: daysAgo(0),
      manualStatus: "healthy" as const,
      now: NOW,
    };
    expect(calculateHealthScore({ ...base, aiSubScore: null })).toBe(
      calculateHealthScore({ ...base, aiSubScore: 50 })
    );
  });
});

describe("sub-scores", () => {
  it("watering loses 10 points a day and never goes below 0", () => {
    expect(wateringSubScore(daysAgo(0), NOW)).toBe(100);
    expect(wateringSubScore(daysAgo(3), NOW)).toBe(70);
    expect(wateringSubScore(daysAgo(30), NOW)).toBe(0);
    expect(wateringSubScore(null, NOW)).toBe(0);
  });

  it("fertilizer loses 8 points a day and never goes below 0", () => {
    expect(fertilizerSubScore(daysAgo(0), NOW)).toBe(100);
    expect(fertilizerSubScore(daysAgo(5), NOW)).toBe(60);
    expect(fertilizerSubScore(daysAgo(40), NOW)).toBe(0);
    expect(fertilizerSubScore(null, NOW)).toBe(0);
  });

  it("maps the grower's own status", () => {
    expect(manualSubScore("healthy")).toBe(100);
    expect(manualSubScore("attention")).toBe(50);
    expect(manualSubScore("critical")).toBe(0);
  });
});

describe("daysSince", () => {
  it("counts whole days and accepts strings or dates", () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(new Date(NOW.getTime() - 86_399_000), NOW)).toBe(0);
    expect(daysSince(daysAgo(4), NOW)).toBe(4);
  });

  it("is never negative for a future date", () => {
    expect(daysSince(daysAgo(-3), NOW)).toBe(0);
  });
});

describe("liveDisplayScore", () => {
  const inputs = {
    aiSubScore: 95,
    lastWaterAt: daysAgo(0),
    lastFertilizeAt: daysAgo(0),
    manualStatus: "healthy" as const,
    now: NOW,
  };

  it('keeps a never-scored plant as "New" (null)', () => {
    expect(liveDisplayScore(null, inputs)).toBeNull();
  });

  it("recomputes the live score for a scored plant", () => {
    expect(liveDisplayScore(10, inputs)).toBe(calculateHealthScore(inputs));
  });
});
