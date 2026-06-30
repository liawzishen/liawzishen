import { notFound } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { ListingDetail } from "@/components/sales/ListingDetail";
import { getListing } from "@/components/sales/demo-listings";

/**
 * Sales · Listing detail + simulated checkout. Reached from a Marketplace card.
 * No real payment or persistence — see ListingDetail.
 */
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ farmId: string; listingId: string }>;
}) {
  const { farmId, listingId } = await params;
  const listing = getListing(listingId);
  if (!listing) notFound();

  return (
    <main className="pb-12">
      <TopNav title={listing.name} backHref={`/farms/${farmId}/sales/market`} />
      <ListingDetail farmId={farmId} listing={listing} />
    </main>
  );
}
