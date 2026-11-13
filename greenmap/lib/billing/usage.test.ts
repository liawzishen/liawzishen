import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getScanAllowance, monthStartISO, nextMonthStartISO } from "./usage";

/** Minimal stand-in for the two queries getScanAllowance runs. */
function fakeSupabase(
  profile: { data: unknown; error: unknown },
  usage: { count: number | null; error: unknown }
) {
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      gte: () => b,
      single: () => Promise.resolve(result),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return b;
  };
  return {
    from: (table: string) => builder(table === "profiles" ? profile : usage),
  } as unknown as SupabaseClient;
}

describe("month boundaries (UTC)", () => {
  it("returns the first instant of the month", () => {
    expect(monthStartISO(new Date("2026-07-18T15:30:00Z"))).toBe("2026-07-01T00:00:00.000Z");
  });

  it("rolls over the year in December", () => {
    expect(nextMonthStartISO(new Date("2026-12-31T23:59:59Z"))).toBe(
      "2027-01-01T00:00:00.000Z"
    );
  });
});

describe("getScanAllowance", () => {
  it("free plan: 5 scans a month minus what was used", async () => {
    const a = await getScanAllowance(
      fakeSupabase({ data: { plan: "percuma", bonus_scans: 0 }, error: null }, { count: 3, error: null }),
      "user-1"
    );
    expect(a).toMatchObject({ plan: "percuma", limit: 5, used: 3, bonus: 0, remaining: 2 });
  });

  it("adds purchased bonus scans after the monthly allowance is used up", async () => {
    const a = await getScanAllowance(
      fakeSupabase({ data: { plan: "percuma", bonus_scans: 2 }, error: null }, { count: 9, error: null }),
      "user-1"
    );
    expect(a.remaining).toBe(2);
  });

  it("reports zero when everything is used", async () => {
    const a = await getScanAllowance(
      fakeSupabase({ data: { plan: "asas", bonus_scans: 0 }, error: null }, { count: 20, error: null }),
      "user-1"
    );
    expect(a.remaining).toBe(0);
  });

  it("unlimited plan has no limit", async () => {
    const a = await getScanAllowance(
      fakeSupabase({ data: { plan: "unlimited", bonus_scans: 0 }, error: null }, { count: 500, error: null }),
      "user-1"
    );
    expect(a).toMatchObject({ limit: null, remaining: null });
  });

  it("treats an unknown plan value as the free plan", async () => {
    const a = await getScanAllowance(
      fakeSupabase({ data: { plan: "hacked", bonus_scans: -4 }, error: null }, { count: 0, error: null }),
      "user-1"
    );
    expect(a).toMatchObject({ plan: "percuma", bonus: 0, remaining: 5 });
  });

  it("degrades (no limit) when the billing tables are missing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = await getScanAllowance(
      fakeSupabase({ data: null, error: { message: "relation does not exist" } }, { count: null, error: null }),
      "user-1"
    );
    expect(a).toMatchObject({ degraded: true, remaining: null });
  });
});
