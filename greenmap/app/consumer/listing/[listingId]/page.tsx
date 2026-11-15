import { notFound } from "next/navigation";
import { getListingAvailability } from "@/lib/marketplace/availability";
import { TopNav } from "@/components/layout/TopNav";
import { ListingDetail } from "@/components/sales/ListingDetail";
import { getListing } from "@/components/sales/demo-listings";

/**
 * Consumer listing detail + simulated checkout. Reached from a consumer
 * Marketplace card. Lives at /consumer/listing/[id] (a separate segment from
 * the /consumer/market tab, so the two don't collide across the route group).
 * Same component as the grower side; only the back/return links differ.
 */
export default async function ConsumerListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const listing = getListing(listingId);
  if (!listing) notFound();

  const { promoted, inStock } = await getListingAvailability(listingId);

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title={listing.name} backHref="/consumer/market" />
      <ListingDetail
        listing={listing}
        promoted={promoted}
        inStock={inStock}
        marketHref="/consumer/market"
        secondaryHref="/consumer/orders"
        secondaryLabel="View My Orders"
      />
    </main>
  );
}
