import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Marketplace } from "@/components/sales/Marketplace";

/**
 * Sales · Marketplace (simulated buyer browse). Listings are mock data;
 * PROMOTED state is real (listing_boosts) and visible to every shopper.
 */
export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  const supabase = await createClient();
  const [{ data }, { data: stock }] = await Promise.all([
    supabase
      .from("listing_boosts")
      .select("listing_id")
      .gt("expires_at", new Date().toISOString()),
    supabase.from("listing_stock").select("listing_id, in_stock"),
  ]);
  const boostedIds = [...new Set((data ?? []).map((b) => b.listing_id as string))];
  const outOfStockIds = (stock ?? [])
    .filter((s) => s.in_stock === false)
    .map((s) => s.listing_id as string);

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Marketplace" backHref={`/farms/${farmId}/sales`} />
      <Marketplace
        basePath={`/farms/${farmId}/sales/market`}
        boostedIds={boostedIds}
        outOfStockIds={outOfStockIds}
      />
    </main>
  );
}
