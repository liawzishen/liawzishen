import { notFound } from "next/navigation";
import { getListingAvailability } from "@/lib/marketplace/availability";
import { TopNav } from "@/components/layout/TopNav";
import { ListingDetail } from "@/components/sales/ListingDetail";
import { getListing } from "@/components/sales/demo-listings";

/**
 * Sales · Listing detail + simulated checkout. Reached from a Marketplace card.
 * No real payment or persistence for orders; the Promoted tag reflects a real
 * listing_boosts record.
 */
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ farmId: string; listingId: string }>;
}) {
  const { farmId, listingId } = await params;
  const listing = getListing(listingId);
  if (!listing) notFound();

  const { promoted, inStock } = await getListingAvailability(listingId);

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title={listing.name} backHref={`/farms/${farmId}/sales/market`} />
      <ListingDetail
        listing={listing}
        promoted={promoted}
        inStock={inStock}
        marketHref={`/farms/${farmId}/sales/market`}
        secondaryHref={`/farms/${farmId}/sales`}
        secondaryLabel="My Sales"
      />
    </main>
  );
}
