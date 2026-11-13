import { describe, expect, it } from "vitest";
import { aggregatePassport } from "./aggregate";

const base = {
  plantDate: "2026-05-01",
  harvestDate: "2026-07-10",
  logs: [] as { event_type: string; metadata: Record<string, unknown> | null }[],
  analysisCount: 0,
  scores: [] as number[],
};

describe("aggregatePassport", () => {
  it("counts grow days from planting to harvest", () => {
    expect(aggregatePassport(base).grow_days).toBe(70);
  });

  it("never reports negative grow days", () => {
    expect(aggregatePassport({ ...base, harvestDate: "2026-04-01" }).grow_days).toBe(0);
  });

  it("averages health and returns 0 with no scores", () => {
    expect(aggregatePassport({ ...base, scores: [80, 90, 71] }).avg_health).toBe(80);
    expect(aggregatePassport(base).avg_health).toBe(0);
  });

  it("earns Pesticide-Free and Organic by default", () => {
    expect(aggregatePassport(base)).toMatchObject({ pesticide_free: true, organic: true });
  });

  it("loses Pesticide-Free when any log has pesticide_used", () => {
    const agg = aggregatePassport({
      ...base,
      logs: [{ event_type: "note", metadata: { pesticide_used: true } }],
    });
    expect(agg.pesticide_free).toBe(false);
    expect(agg.organic).toBe(true);
  });

  it("loses Organic only for a chemical FERTILIZE log", () => {
    const chemical = { fertilizer_category: "chemical" };
    expect(
      aggregatePassport({ ...base, logs: [{ event_type: "fertilize", metadata: chemical }] })
        .organic
    ).toBe(false);
    expect(
      aggregatePassport({ ...base, logs: [{ event_type: "note", metadata: chemical }] }).organic
    ).toBe(true);
  });

  it("summarises fertilizer use with unique, trimmed type names", () => {
    const agg = aggregatePassport({
      ...base,
      logs: [
        { event_type: "fertilize", metadata: { fertilizer_type: " Compost " } },
        { event_type: "fertilize", metadata: { fertilizer_type: "Compost" } },
        { event_type: "fertilize", metadata: null },
        { event_type: "water", metadata: {} },
      ],
    });
    expect(agg.fertilizer_summary).toEqual({ types: ["Compost"], count: 3 });
  });

  it("is AI-Verified only with at least one scan", () => {
    expect(aggregatePassport(base).ai_verified).toBe(false);
    expect(aggregatePassport({ ...base, analysisCount: 2 })).toMatchObject({
      ai_verified: true,
      ai_scan_count: 2,
    });
  });
});
