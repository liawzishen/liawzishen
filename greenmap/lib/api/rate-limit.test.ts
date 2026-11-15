import { describe, expect, it } from "vitest";
import { LIMITS, createMemoryLimiter, type RateLimitRule } from "./rate-limit";

const rule: RateLimitRule = { name: "test", max: 3, windowSeconds: 60, shared: false };

describe("createMemoryLimiter", () => {
  it("allows up to the maximum, then says how long to wait", () => {
    let now = 1_000_000;
    const limiter = createMemoryLimiter(() => now);
    expect([1, 2, 3].map(() => limiter.take("a", rule))).toEqual([0, 0, 0]);

    now += 20_000;
    expect(limiter.take("a", rule)).toBe(40); // 60 s window, 20 s gone
    expect(limiter.take("a", rule)).toBe(40);
  });

  it("starts a new window when the old one has passed", () => {
    let now = 0;
    const limiter = createMemoryLimiter(() => now);
    for (let i = 0; i < 5; i++) limiter.take("a", rule);
    expect(limiter.take("a", rule)).toBeGreaterThan(0);

    now += 60_000;
    expect(limiter.take("a", rule)).toBe(0);
  });

  it("counts each person separately", () => {
    const limiter = createMemoryLimiter(() => 0);
    for (let i = 0; i < 4; i++) limiter.take("a", rule);
    expect(limiter.take("a", rule)).toBeGreaterThan(0);
    expect(limiter.take("b", rule)).toBe(0);
  });

  it("never reports a wait of zero for a refused request", () => {
    let now = 0;
    const limiter = createMemoryLimiter(() => now);
    for (let i = 0; i < 3; i++) limiter.take("a", rule);
    now = 59_999; // one millisecond before the window ends
    expect(limiter.take("a", rule)).toBe(1);
  });

  it("does not grow without bound: old counters are swept out", () => {
    let now = 0;
    const limiter = createMemoryLimiter(() => now);
    for (let i = 0; i < 5_000; i++) limiter.take(`user-${i}`, rule);
    expect(limiter.size()).toBe(5_000);

    now += 2 * 3_600_000; // two hours later every counter is stale
    limiter.take("someone-new", rule);
    expect(limiter.size()).toBe(1);
  });
});

describe("LIMITS", () => {
  it("names every rule after its key, so counters cannot collide", () => {
    for (const [key, limit] of Object.entries(LIMITS)) expect(limit.name).toBe(key);
  });

  it("counts the routes that cost money across all server instances", () => {
    for (const key of ["scan", "suggest", "chat", "satellite", "payment"] as const) {
      expect(LIMITS[key].shared).toBe(true);
    }
  });
});
