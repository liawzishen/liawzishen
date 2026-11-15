import { describe, expect, it } from "vitest";
import { healthDisplay } from "./display";

describe("healthDisplay", () => {
  it("uses the documented score bands", () => {
    expect(healthDisplay(100).band).toBe("healthy");
    expect(healthDisplay(70).band).toBe("healthy");
    expect(healthDisplay(69).band).toBe("attention");
    expect(healthDisplay(40).band).toBe("attention");
    expect(healthDisplay(39).band).toBe("critical");
    expect(healthDisplay(0).band).toBe("critical");
  });

  it('shows "New" when there is no score yet', () => {
    expect(healthDisplay(null)).toMatchObject({ band: "new", label: "New" });
  });

  it("gives every band its own icon, so colour is never the only signal", () => {
    const icons = [100, 50, 10, null].map((s) => healthDisplay(s).icon);
    expect(new Set(icons).size).toBe(4);
  });

  it("gives every band the badge tone that matches its colour", () => {
    expect(healthDisplay(90).tone).toBe("brand");
    expect(healthDisplay(55).tone).toBe("warning");
    expect(healthDisplay(10).tone).toBe("critical");
    expect(healthDisplay(null).tone).toBe("neutral");
  });
});
