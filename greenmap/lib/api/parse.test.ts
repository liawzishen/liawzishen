import { describe, expect, it } from "vitest";
import { asNumber, isDateISO, isOneOf } from "./parse";

describe("isDateISO", () => {
  it("accepts real calendar dates", () => {
    expect(isDateISO("2026-11-16")).toBe(true);
    expect(isDateISO("2028-02-29")).toBe(true); // leap year
  });

  it("rejects dates that do not exist and other formats", () => {
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "16/11/2026", "2026-1-1", "", "today", 20261116, null]) {
      expect(isDateISO(bad), String(bad)).toBe(false);
    }
  });
});

describe("isOneOf / asNumber", () => {
  it("only accepts a listed string", () => {
    const sizes = ["small", "large"] as const;
    expect(isOneOf("small", sizes)).toBe(true);
    for (const bad of ["Small", "medium", "", 1, null, ["small"]]) expect(isOneOf(bad, sizes)).toBe(false);
  });

  it("only accepts real, finite numbers", () => {
    expect(asNumber(0)).toBe(0);
    expect(asNumber(-3.5)).toBe(-3.5);
    for (const bad of ["0.5", NaN, Infinity, null, undefined, {}, true]) expect(asNumber(bad)).toBeNull();
  });
});
