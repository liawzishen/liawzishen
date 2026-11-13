import { describe, expect, it } from "vitest";
import {
  fallbackResult,
  mockResult,
  parseScanResult,
  sanitizeResult,
  subScoreForSeverity,
} from "./validate";

const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    diagnosis: "Early blight on lower leaves.",
    severity: "moderate",
    confidence: 81,
    recommendations: ["Remove affected leaves.", "Avoid overhead watering."],
    ...over,
  });

describe("parseScanResult", () => {
  it("parses a clean JSON reply", () => {
    expect(parseScanResult(reply())).toEqual({
      diagnosis: "Early blight on lower leaves.",
      severity: "moderate",
      confidence: 81,
      ai_sub_score: 50,
      recommendations: ["Remove affected leaves.", "Avoid overhead watering."],
    });
  });

  it("reads JSON inside a markdown code fence", () => {
    expect(parseScanResult("```json\n" + reply() + "\n```").severity).toBe("moderate");
  });

  it("reads JSON wrapped in prose", () => {
    expect(parseScanResult(`Here is the result: ${reply()} Hope it helps.`).confidence).toBe(81);
  });

  it("always derives the sub-score from severity, never from the reply", () => {
    const parsed = parseScanResult(reply({ severity: "severe", ai_sub_score: 100 }));
    expect(parsed.ai_sub_score).toBe(subScoreForSeverity("severe"));
    expect(parsed.ai_sub_score).toBe(20);
  });

  it("accepts severity in any letter case", () => {
    expect(parseScanResult(reply({ severity: " Mild " })).severity).toBe("mild");
  });

  it("rejects an unknown severity instead of guessing healthy", () => {
    expect(() => parseScanResult(reply({ severity: "very bad" }))).toThrow();
    expect(() => parseScanResult(reply({ severity: undefined }))).toThrow();
  });

  it("rejects replies that are not a JSON object", () => {
    expect(() => parseScanResult("I cannot analyse this image.")).toThrow();
    expect(() => parseScanResult("null")).toThrow();
    expect(() => parseScanResult("[1, 2]")).toThrow();
  });

  it("clamps confidence to 0–100 and rounds it", () => {
    expect(parseScanResult(reply({ confidence: 250 })).confidence).toBe(100);
    expect(parseScanResult(reply({ confidence: -5 })).confidence).toBe(0);
    expect(parseScanResult(reply({ confidence: "72.6" })).confidence).toBe(73);
    expect(parseScanResult(reply({ confidence: "high" })).confidence).toBe(0);
  });

  it("keeps at most four recommendations and adds a default when none are usable", () => {
    const many = parseScanResult(reply({ recommendations: ["a", "b", "c", "d", "e", 7, ""] }));
    expect(many.recommendations).toEqual(["a", "b", "c", "d"]);
    expect(parseScanResult(reply({ recommendations: "water it" })).recommendations).toHaveLength(1);
  });

  it("caps very long text", () => {
    const parsed = parseScanResult(
      reply({ diagnosis: "x".repeat(5000), recommendations: ["y".repeat(5000)] })
    );
    expect(parsed.diagnosis.length).toBe(400);
    expect(parsed.recommendations[0].length).toBe(200);
  });
});

describe("sanitizeResult", () => {
  it("recomputes the sub-score, ignoring what the browser sent", () => {
    const clean = sanitizeResult({
      diagnosis: "Healthy",
      severity: "severe",
      confidence: 90,
      ai_sub_score: 99,
      recommendations: ["Keep watering."],
    });
    expect(clean.ai_sub_score).toBe(20);
  });

  it("drops fields it does not know", () => {
    const clean = sanitizeResult({ severity: "mild", mock: true, extra: "<script>" });
    expect(Object.keys(clean).sort()).toEqual(
      ["ai_sub_score", "confidence", "diagnosis", "recommendations", "severity"].sort()
    );
  });

  it("survives non-object input", () => {
    for (const bad of [null, undefined, "text", 42]) {
      expect(sanitizeResult(bad)).toMatchObject({ severity: "none", confidence: 0 });
    }
  });
});

describe("fallback and mock results", () => {
  it("marks a failed analysis as an error", () => {
    expect(fallbackResult("ai")).toMatchObject({ error: true, confidence: 0 });
    expect(fallbackResult("image").diagnosis).toMatch(/photo/i);
  });

  it("labels the sample result as a mock", () => {
    const mock = mockResult("tomato");
    expect(mock.mock).toBe(true);
    expect(mock.diagnosis).toMatch(/tomato/);
    expect(mock.diagnosis).toMatch(/demo/i);
  });
});
