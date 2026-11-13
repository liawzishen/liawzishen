import { describe, expect, it } from "vitest";
import { chunk, cn, mapInBatches } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});

describe("chunk", () => {
  it("splits a list into pieces of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("treats a size below 1 as 1", () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("mapInBatches", () => {
  it("keeps result order and never runs more than the batch size at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapInBatches([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
