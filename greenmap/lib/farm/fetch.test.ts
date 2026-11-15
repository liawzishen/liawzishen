import { describe, expect, it } from "vitest";
import { countByFarm } from "./fetch";

describe("countByFarm", () => {
  it("counts the rows of each farm", () => {
    expect(
      countByFarm([{ farm_id: "a" }, { farm_id: "b" }, { farm_id: "a" }, { farm_id: "a" }])
    ).toEqual({ a: 3, b: 1 });
  });

  it("has no entry for a farm without rows", () => {
    expect(countByFarm([])).toEqual({});
  });
});
