import { describe, expect, it } from "vitest";
import { daysUntilLocalDate, localDateISO } from "./date";

describe("localDateISO (Malaysia, UTC+8)", () => {
  it("is already the next day in Malaysia late in the UTC evening", () => {
    // 7:30 am on 11 July in Kuala Lumpur.
    expect(localDateISO(new Date("2026-07-10T23:30:00Z"))).toBe("2026-07-11");
  });

  it("matches the UTC date during the Malaysian afternoon", () => {
    expect(localDateISO(new Date("2026-07-10T06:00:00Z"))).toBe("2026-07-10");
  });

  it("changes exactly at Malaysian midnight (16:00 UTC)", () => {
    expect(localDateISO(new Date("2026-12-31T15:59:59Z"))).toBe("2026-12-31");
    expect(localDateISO(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });

  it("pads single-digit months and days", () => {
    expect(localDateISO(new Date("2026-03-04T02:00:00Z"))).toBe("2026-03-04");
  });
});

describe("daysUntilLocalDate", () => {
  // 7:30 am on 11 July in Kuala Lumpur (still 10 July in UTC).
  const now = new Date("2026-07-10T23:30:00Z");

  it("is 0 for today in Malaysia, not for the UTC date", () => {
    expect(daysUntilLocalDate("2026-07-11", now)).toBe(0);
    expect(daysUntilLocalDate("2026-07-10", now)).toBe(-1);
  });

  it("counts future days", () => {
    expect(daysUntilLocalDate("2026-07-18", now)).toBe(7);
    expect(daysUntilLocalDate("2026-08-01", now)).toBe(21);
  });
});
