import { createClient } from "@/lib/supabase/server";
import { SalesDashboard } from "@/components/sales/SalesDashboard";

/**
 * Sales tab — "My Sales" hub. Simulated marketplace preview; listing BOOSTS
 * are real records (listing_boosts) so Promoted state survives reloads.
 */
export default async function SalesPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const boosts: Record<string, string> = {};
  if (user) {
    const { data } = await supabase
      .from("listing_boosts")
      .select("listing_id, expires_at")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString());
    for (const b of data ?? []) {
      if (!boosts[b.listing_id] || boosts[b.listing_id] < b.expires_at) {
        boosts[b.listing_id] = b.expires_at;
      }
    }
  }

  return <SalesDashboard farmId={farmId} boosts={boosts} />;
}
