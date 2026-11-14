import { describe, expect, it } from "vitest";
import { shouldSaveData, whenIdle } from "./network";

describe("shouldSaveData", () => {
  it("is false when the browser gives no network information", () => {
    expect(shouldSaveData(undefined)).toBe(false);
    expect(shouldSaveData({})).toBe(false);
  });

  it("is true when the visitor turned on Data Saver", () => {
    expect(shouldSaveData({ connection: { saveData: true } })).toBe(true);
  });

  it("is true on 2G and false on faster links", () => {
    expect(shouldSaveData({ connection: { effectiveType: "slow-2g" } })).toBe(true);
    expect(shouldSaveData({ connection: { effectiveType: "2g" } })).toBe(true);
    expect(shouldSaveData({ connection: { effectiveType: "3g" } })).toBe(false);
    expect(shouldSaveData({ connection: { effectiveType: "4g" } })).toBe(false);
  });
});

describe("whenIdle", () => {
  it("does nothing on the server and still returns a cancel function", () => {
    let ran = false;
    const cancel = whenIdle(() => {
      ran = true;
    });
    expect(typeof cancel).toBe("function");
    cancel();
    expect(ran).toBe(false);
  });
});
