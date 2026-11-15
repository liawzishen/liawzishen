import { getMarketAvailability } from "@/lib/marketplace/availability";
import { Marketplace } from "@/components/sales/Marketplace";

/**
 * Consumer marketplace — the buyer-facing product browse. Same ranked listing
 * feed as the grower-side preview (paid boosts first, then the weighted
 * organic score), linked to the consumer listing-detail route.
 */
export default async function ConsumerMarketPage() {
  const { boostedIds, outOfStockIds } = await getMarketAvailability();

  return (
    <main className="lg:mx-auto lg:w-full lg:max-w-[720px]">
      <div className="px-5 pt-12">
        <h1 className="text-[28px] font-bold leading-tight">Market</h1>
      </div>
      <Marketplace
        basePath="/consumer/listing"
        boostedIds={boostedIds}
        outOfStockIds={outOfStockIds}
      />
    </main>
  );
}
