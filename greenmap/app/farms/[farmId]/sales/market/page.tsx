import { getMarketAvailability } from "@/lib/marketplace/availability";
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

  const { boostedIds, outOfStockIds } = await getMarketAvailability();

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
