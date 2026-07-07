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
  const { data } = await supabase
    .from("listing_boosts")
    .select("listing_id")
    .gt("expires_at", new Date().toISOString());
  const boostedIds = [...new Set((data ?? []).map((b) => b.listing_id as string))];

  return (
    <main className="pb-12">
      <TopNav title="Marketplace" backHref={`/farms/${farmId}/sales`} />
      <Marketplace
        basePath={`/farms/${farmId}/sales/market`}
        boostedIds={boostedIds}
      />
    </main>
  );
}
