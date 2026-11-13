import { describe, expect, it } from "vitest";
import {
  BOOST_PACKAGES,
  PLANS,
  PLAN_ORDER,
  formatRM,
  isBoostPackageId,
  isPlanId,
} from "./plans";

describe("plans", () => {
  it("lists every plan once, cheapest first", () => {
    expect([...PLAN_ORDER].sort()).toEqual(Object.keys(PLANS).sort());
    const prices = PLAN_ORDER.map((id) => PLANS[id].priceRM);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("gives more scans on every higher plan (null = unlimited)", () => {
    const scans = PLAN_ORDER.map((id) => PLANS[id].scansPerMonth ?? Infinity);
    expect(scans).toEqual([...scans].sort((a, b) => a - b));
    expect(PLANS.unlimited.scansPerMonth).toBeNull();
  });

  it("keeps each definition's id equal to its key", () => {
    for (const [key, plan] of Object.entries(PLANS)) expect(plan.id).toBe(key);
    for (const [key, pkg] of Object.entries(BOOST_PACKAGES)) expect(pkg.id).toBe(key);
  });

  it("validates ids from untrusted input", () => {
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("gold")).toBe(false);
    expect(isPlanId(undefined)).toBe(false);
    expect(isBoostPackageId("7d")).toBe(true);
    expect(isBoostPackageId("30d")).toBe(false);
    expect(isBoostPackageId(7)).toBe(false);
  });

  it("formats ringgit with two decimals", () => {
    expect(formatRM(6.9)).toBe("RM 6.90");
    expect(formatRM(0)).toBe("RM 0.00");
  });
});
