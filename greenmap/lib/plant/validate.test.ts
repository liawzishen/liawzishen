import { describe, expect, it } from "vitest";
import { parseCareLog, parseManualStatus, parseNewPlant } from "./validate";

const FARM = "22222222-2222-4222-8222-222222222222";
const ZONE = "66666666-6666-4666-8666-666666666666";
const PLANT = "33333333-3333-4333-8333-333333333331";
const TODAY = "2026-11-16";

describe("parseNewPlant", () => {
  const good = { farmId: FARM, zoneId: ZONE, name: " Tomato  A1 ", type: "Tomato", expectedHarvestDate: "2027-01-20", position: { x: 0.25, y: 0.5 } };
  const parse = (patch: Record<string, unknown> = {}) => parseNewPlant({ ...good, ...patch }, TODAY);
  const error = (patch: Record<string, unknown>) => {
    const result = parse(patch);
    return result.ok ? null : result.error;
  };

  it("accepts the form's data", () => {
    expect(parse()).toEqual({
      ok: true,
      value: { farmId: FARM, zoneId: ZONE, name: "Tomato A1", type: "Tomato", expectedHarvestDate: "2027-01-20", position: { x: 0.25, y: 0.5 } },
    });
  });

  it("treats a missing zone and a missing harvest date as 'none'", () => {
    for (const empty of [null, undefined, ""]) {
      const result = parse({ zoneId: empty, expectedHarvestDate: empty });
      expect(result.ok && [result.value.zoneId, result.value.expectedHarvestDate]).toEqual([null, null]);
    }
  });

  it("needs real ids", () => {
    expect(error({ farmId: "farm-1" })).toMatch(/farmId/);
    expect(error({ farmId: undefined })).toMatch(/farmId/);
    expect(error({ zoneId: "1 or 1=1" })).toMatch(/zone/);
  });

  it("needs a name and a type of a sensible length", () => {
    expect(error({ name: "   " })).toMatch(/plant name/);
    expect(error({ name: "x".repeat(61) })).toMatch(/plant name/);
    expect(error({ type: "" })).toMatch(/crop type/);
  });

  it("accepts a harvest date from a year ago to ten years ahead", () => {
    expect(parse({ expectedHarvestDate: TODAY }).ok).toBe(true);
    expect(parse({ expectedHarvestDate: "2025-11-16" }).ok).toBe(true); // already ready to harvest
    expect(parse({ expectedHarvestDate: "2036-11-16" }).ok).toBe(true);
    for (const bad of ["2025-11-15", "2036-11-17", "1900-01-01", "2026-02-30", "next week", 20270120]) {
      expect(error({ expectedHarvestDate: bad }), String(bad)).toMatch(/harvest date/);
    }
  });

  it("keeps the plant on the map", () => {
    const off = parse({ position: { x: -0.2, y: 1.7 } });
    expect(off.ok && off.value.position).toEqual({ x: 0, y: 1 });
    for (const bad of [undefined, null, {}, { x: "0.5", y: 0.5 }, { x: NaN, y: 0 }, [0.5, 0.5]]) {
      expect(error({ position: bad }), JSON.stringify(bad)).toMatch(/position/);
    }
  });

  it("does not pass on fields the grower must not set", () => {
    const result = parse({ health_score: 100, lifecycle_status: "harvested", plant_date: "2001-01-01" });
    expect(result.ok && Object.keys(result.value).sort()).toEqual(
      ["expectedHarvestDate", "farmId", "name", "position", "type", "zoneId"]
    );
  });
});

describe("parseCareLog", () => {
  const log = (body: Record<string, unknown>) => {
    const result = parseCareLog({ plantId: PLANT, ...body });
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const error = (body: Record<string, unknown>) => {
    const result = parseCareLog({ plantId: PLANT, ...body });
    return result.ok ? null : result.error;
  };

  it("builds a watering log (no note; the method is optional)", () => {
    expect(log({ type: "water" })).toEqual({ plantId: PLANT, eventType: "water", note: null, metadata: {} });
    expect(log({ type: "water", method: " Drip  line " }).metadata).toEqual({ method: "Drip line" });
  });

  it("builds a fertilizer log with the badge data", () => {
    expect(log({ type: "fertilize", fertilizerType: "Compost tea", category: "organic", amount: "2 L", pesticideUsed: false })).toEqual({
      plantId: PLANT,
      eventType: "fertilize",
      note: "Compost tea",
      metadata: { fertilizer_type: "Compost tea", fertilizer_category: "organic", amount: "2 L", pesticide_used: false },
    });
    // Nothing filled in: still a valid log, with an honest "unknown" category.
    expect(log({ type: "fertilize" })).toEqual({
      plantId: PLANT,
      eventType: "fertilize",
      note: null,
      metadata: { fertilizer_category: "unknown", pesticide_used: false },
    });
    expect(log({ type: "fertilize", category: "magic" }).metadata).toMatchObject({ fertilizer_category: "unknown" });
  });

  it("builds a note and keeps its line breaks", () => {
    expect(log({ type: "note", text: "  Leaves curling.\nCheck again Friday.  ", pesticideUsed: true, pesticideType: "Neem oil" })).toEqual({
      plantId: PLANT,
      eventType: "note",
      note: "Leaves curling.\nCheck again Friday.",
      metadata: { pesticide_used: true, pesticide_type: "Neem oil" },
    });
    expect(log({ type: "note", text: "All good" }).metadata).toEqual({ pesticide_used: false });
  });

  it("counts pesticide only when the box is really ticked", () => {
    for (const notTrue of ["true", 1, "yes", null, undefined]) {
      expect(log({ type: "note", text: "x", pesticideUsed: notTrue }).metadata).toEqual({ pesticide_used: false });
    }
  });

  it("needs a note to have text, within the limit", () => {
    expect(error({ type: "note", text: "   " })).toMatch(/note/);
    expect(error({ type: "note" })).toMatch(/note/);
    expect(error({ type: "note", text: "x".repeat(2001) })).toMatch(/note/);
    expect(log({ type: "note", text: "x".repeat(2000) }).note).toHaveLength(2000);
  });

  it("refuses the event types only the server may write", () => {
    for (const type of ["ai_scan", "harvested", "planted", "", undefined]) {
      expect(error({ type }), String(type)).toMatch(/water, fertilize or note/);
    }
  });

  it("never copies metadata, a note or a date from the request", () => {
    const sneaky = log({
      type: "water",
      note: "Certified organic",
      metadata: { fertilizer_category: "organic", severity: "none", confidence: 100 },
      created_at: "2001-01-01",
      event_type: "ai_scan",
    });
    expect(sneaky).toEqual({ plantId: PLANT, eventType: "water", note: null, metadata: {} });
  });

  it("needs a real plant id", () => {
    expect(parseCareLog({ plantId: "p1", type: "water" })).toEqual({ ok: false, error: "plantId is required." });
  });
});

describe("parseManualStatus", () => {
  it("accepts the three statuses", () => {
    for (const status of ["healthy", "attention", "critical"]) {
      expect(parseManualStatus({ plantId: PLANT, status })).toEqual({ ok: true, value: { plantId: PLANT, status } });
    }
  });

  it("refuses anything else", () => {
    for (const status of ["Healthy", "harvested", "", 100, null]) {
      expect(parseManualStatus({ plantId: PLANT, status }).ok).toBe(false);
    }
    expect(parseManualStatus({ plantId: "x", status: "healthy" }).ok).toBe(false);
  });
});
