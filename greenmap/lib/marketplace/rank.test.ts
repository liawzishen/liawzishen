import { describe, expect, it } from "vitest";
import { rankListings, type Rankable } from "./rank";

const NOW = new Date("2026-07-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function listing(id: string, over: Partial<Rankable> = {}): Rankable {
  return {
    id,
    salesCount: 10,
    impressions: 200,
    clicks: 20,
    medianDwellSeconds: 20,
    harvestedAt: hoursAgo(12),
    distanceKm: 5,
    verified: true,
    badges: ["Organic"],
    avgHealth: 80,
    ...over,
  };
}

const ids = (ranked: { listing: Rankable }[]) => ranked.map((r) => r.listing.id);

describe("rankListings", () => {
  it("returns an empty list for no listings", () => {
    expect(rankListings([], { now: NOW })).toEqual([]);
  });

  it("does not change the input array", () => {
    const input = [listing("b", { salesCount: 1 }), listing("a", { salesCount: 99 })];
    const before = ids(input.map((l) => ({ listing: l })));
    rankListings(input, { now: NOW });
    expect(ids(input.map((l) => ({ listing: l })))).toEqual(before);
  });

  it("keeps scores between 0 and 100", () => {
    const ranked = rankListings(
      [listing("a"), listing("b", { salesCount: 0, impressions: 0, clicks: 0, distanceKm: 900 })],
      { now: NOW }
    );
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("ranks the better organic listing first", () => {
    const ranked = rankListings(
      [
        listing("weak", { salesCount: 1, clicks: 2, harvestedAt: hoursAgo(96), distanceKm: 40 }),
        listing("strong", { salesCount: 120, clicks: 60 }),
      ],
      { now: NOW }
    );
    expect(ids(ranked)).toEqual(["strong", "weak"]);
  });

  it("prefers fresher and closer produce when all else is equal", () => {
    expect(
      ids(rankListings([listing("old", { harvestedAt: hoursAgo(90) }), listing("fresh")], { now: NOW }))
    ).toEqual(["fresh", "old"]);
    expect(
      ids(rankListings([listing("far", { distanceKm: 60 }), listing("near")], { now: NOW }))
    ).toEqual(["near", "far"]);
  });

  it("puts a boosted listing on top with the promoted label", () => {
    const ranked = rankListings(
      [listing("strong", { salesCount: 120 }), listing("paid", { salesCount: 1 })],
      { now: NOW, boostedIds: ["paid"] }
    );
    expect(ranked[0]).toMatchObject({ promoted: true, reason: "promoted" });
    expect(ranked[0].listing.id).toBe("paid");
    expect(ranked[1].promoted).toBe(false);
  });

  it("caps promoted slots so ads cannot fill the board", () => {
    const all = ["a", "b", "c", "d"].map((id) => listing(id));
    const ranked = rankListings(all, { now: NOW, boostedIds: ["a", "b", "c", "d"] });
    expect(ranked.filter((r) => r.promoted)).toHaveLength(2);
    expect(ranked).toHaveLength(4);

    const one = rankListings(all, { now: NOW, boostedIds: ["a", "b"], maxPromoted: 1 });
    expect(one.filter((r) => r.promoted)).toHaveLength(1);
  });

  it("never promotes a sold-out or expired listing", () => {
    const ranked = rankListings(
      [
        listing("soldout", { inStock: false }),
        listing("expired", { expiresAt: hoursAgo(1) }),
        listing("ok"),
      ],
      { now: NOW, boostedIds: ["soldout", "expired"] }
    );
    expect(ranked.some((r) => r.promoted)).toBe(false);
  });

  it('labels a listing with no history as "new"', () => {
    const ranked = rankListings(
      [listing("veteran"), listing("newcomer", { salesCount: 0, impressions: 0, clicks: 0 })],
      { now: NOW }
    );
    expect(ranked.find((r) => r.listing.id === "newcomer")?.reason).toBe("new");
  });

  it("orders exact ties the same way every time", () => {
    const a = ids(rankListings([listing("b"), listing("a"), listing("c")], { now: NOW }));
    const b = ids(rankListings([listing("c"), listing("b"), listing("a")], { now: NOW }));
    expect(a).toEqual(b);
    expect(a).toEqual(["a", "b", "c"]);
  });

  it("copes with an invalid harvest date", () => {
    const ranked = rankListings([listing("bad", { harvestedAt: "not-a-date" }), listing("ok")], {
      now: NOW,
    });
    expect(ids(ranked)[0]).toBe("ok");
    for (const r of ranked) expect(Number.isFinite(r.score)).toBe(true);
  });
});
