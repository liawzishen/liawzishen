import { describe, expect, it } from "vitest";
import {
  boostedListingIds,
  latestBoostExpiry,
  outOfStockListingIds,
  stockByListing,
} from "./availability";

describe("boostedListingIds", () => {
  it("lists each boosted listing once", () => {
    expect(
      boostedListingIds([{ listing_id: "a" }, { listing_id: "b" }, { listing_id: "a" }])
    ).toEqual(["a", "b"]);
  });

  it("is empty when nothing is boosted", () => {
    expect(boostedListingIds([])).toEqual([]);
  });
});

describe("outOfStockListingIds", () => {
  it("keeps only listings marked out of stock", () => {
    expect(
      outOfStockListingIds([
        { listing_id: "a", in_stock: true },
        { listing_id: "b", in_stock: false },
      ])
    ).toEqual(["b"]);
  });
});

describe("latestBoostExpiry", () => {
  it("keeps the latest expiry when a listing was boosted more than once", () => {
    expect(
      latestBoostExpiry([
        { listing_id: "a", expires_at: "2026-11-20T00:00:00Z" },
        { listing_id: "a", expires_at: "2026-11-25T00:00:00Z" },
        { listing_id: "a", expires_at: "2026-11-22T00:00:00Z" },
        { listing_id: "b", expires_at: "2026-11-18T00:00:00Z" },
      ])
    ).toEqual({ a: "2026-11-25T00:00:00Z", b: "2026-11-18T00:00:00Z" });
  });
});

describe("stockByListing", () => {
  it("maps each listing to its stock flag", () => {
    expect(
      stockByListing([
        { listing_id: "a", in_stock: true },
        { listing_id: "b", in_stock: false },
      ])
    ).toEqual({ a: true, b: false });
  });
});
