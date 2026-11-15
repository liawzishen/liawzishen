import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/user";

/*
 * What the marketplace pages read from the database: which listings are
 * PROMOTED (a live `listing_boosts` row) and which are out of stock
 * (`listing_stock`). The listings themselves are still demo data.
 *
 * Four pages need this, so it lives here once. The shaping functions are
 * pure (unit tested); the loaders below only fetch and call them.
 * `listing_stock` may not exist yet (migration 0008) — a failed query then
 * simply means "everything is in stock".
 */

type BoostRow = { listing_id: string; expires_at?: string };
type StockRow = { listing_id: string; in_stock: boolean };

/** Listing ids with at least one live boost (each id once). */
export function boostedListingIds(rows: readonly BoostRow[]): string[] {
  return [...new Set(rows.map((row) => row.listing_id))];
}

/** Listing ids the seller marked as out of stock. */
export function outOfStockListingIds(rows: readonly StockRow[]): string[] {
  return rows.filter((row) => row.in_stock === false).map((row) => row.listing_id);
}

/** Listing id → the latest expiry among its boosts (ISO timestamps). */
export function latestBoostExpiry(
  rows: readonly Required<BoostRow>[]
): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const row of rows) {
    if (!latest[row.listing_id] || latest[row.listing_id] < row.expires_at) {
      latest[row.listing_id] = row.expires_at;
    }
  }
  return latest;
}

/** Listing id → in stock? (only listings that have a stock row). */
export function stockByListing(rows: readonly StockRow[]): Record<string, boolean> {
  const stock: Record<string, boolean> = {};
  for (const row of rows) stock[row.listing_id] = row.in_stock;
  return stock;
}

export interface MarketAvailability {
  boostedIds: string[];
  outOfStockIds: string[];
}

/** The marketplace browse pages (grower preview and consumer market). */
export const getMarketAvailability = cache(async (): Promise<MarketAvailability> => {
  const supabase = await createClient();
  const [{ data: boosts }, { data: stock }] = await Promise.all([
    supabase
      .from("listing_boosts")
      .select("listing_id")
      .gt("expires_at", new Date().toISOString()),
    supabase.from("listing_stock").select("listing_id, in_stock"),
  ]);
  return {
    boostedIds: boostedListingIds((boosts ?? []) as BoostRow[]),
    outOfStockIds: outOfStockListingIds((stock ?? []) as StockRow[]),
  };
});

export interface ListingAvailability {
  promoted: boolean;
  inStock: boolean;
}

/** One listing's detail page. */
export const getListingAvailability = cache(
  async (listingId: string): Promise<ListingAvailability> => {
    const supabase = await createClient();
    const [{ data: boosts }, { data: stock }] = await Promise.all([
      supabase
        .from("listing_boosts")
        .select("id")
        .eq("listing_id", listingId)
        .gt("expires_at", new Date().toISOString())
        .limit(1),
      supabase
        .from("listing_stock")
        .select("in_stock")
        .eq("listing_id", listingId)
        .maybeSingle(),
    ]);
    return {
      promoted: (boosts ?? []).length > 0,
      inStock: (stock as { in_stock: boolean } | null)?.in_stock !== false,
    };
  }
);

export interface SalesOverview {
  /** The signed-in grower's live boosts: listing id → expiry. */
  boosts: Record<string, string>;
  farmName: string | null;
  /** Listing id → in stock? */
  stock: Record<string, boolean>;
}

/** The grower's Sales tab. */
export const getSalesOverview = cache(
  async (farmId: string): Promise<SalesOverview> => {
    const supabase = await createClient();

    // The three queries do not depend on each other, so they run together.
    // Only the boosts need the user id, and they start the moment it is known.
    const [boostRows, { data: farm }, { data: stockRows }] = await Promise.all([
      getAuthUser().then(async (user) => {
        if (!user) return [];
        const { data } = await supabase
          .from("listing_boosts")
          .select("listing_id, expires_at")
          .eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString());
        return (data ?? []) as Required<BoostRow>[];
      }),
      supabase.from("farms").select("name").eq("id", farmId).maybeSingle(),
      supabase.from("listing_stock").select("listing_id, in_stock"),
    ]);

    return {
      boosts: latestBoostExpiry(boostRows),
      farmName: (farm as { name: string } | null)?.name ?? null,
      stock: stockByListing((stockRows ?? []) as StockRow[]),
    };
  }
);
