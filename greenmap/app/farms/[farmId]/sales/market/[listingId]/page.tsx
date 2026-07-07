import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const [{ data }, { data: stock }] = await Promise.all([
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

  return (
    <main className="pb-12">
      <TopNav title={listing.name} backHref={`/farms/${farmId}/sales/market`} />
      <ListingDetail
        listing={listing}
        promoted={(data ?? []).length > 0}
        inStock={(stock as { in_stock: boolean } | null)?.in_stock !== false}
        marketHref={`/farms/${farmId}/sales/market`}
        secondaryHref={`/farms/${farmId}/sales`}
        secondaryLabel="My Sales"
      />
    </main>
  );
}
