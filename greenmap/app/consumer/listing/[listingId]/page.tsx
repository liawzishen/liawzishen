import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_boosts")
    .select("id")
    .eq("listing_id", listingId)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  return (
    <main className="pb-12">
      <TopNav title={listing.name} backHref="/consumer/market" />
      <ListingDetail
        listing={listing}
        promoted={(data ?? []).length > 0}
        marketHref="/consumer/market"
        secondaryHref="/consumer/orders"
        secondaryLabel="View My Orders"
      />
    </main>
  );
}
