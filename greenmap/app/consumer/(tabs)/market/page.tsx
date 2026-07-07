import { createClient } from "@/lib/supabase/server";
import { Marketplace } from "@/components/sales/Marketplace";

/**
 * Consumer marketplace — the buyer-facing product browse. Same ranked listing
 * feed as the grower-side preview (paid boosts first, then the weighted
 * organic score), linked to the consumer listing-detail route.
 */
export default async function ConsumerMarketPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_boosts")
    .select("listing_id")
    .gt("expires_at", new Date().toISOString());
  const boostedIds = [...new Set((data ?? []).map((b) => b.listing_id as string))];

  return (
    <main>
      <div className="px-5 pt-12">
        <h1 className="text-[28px] font-bold leading-tight">Market</h1>
      </div>
      <Marketplace basePath="/consumer/listing" boostedIds={boostedIds} />
    </main>
  );
}
