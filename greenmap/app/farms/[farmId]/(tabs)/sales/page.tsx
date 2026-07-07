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

  // Farm name + stock levels (listing_stock may not exist yet → ignore errors).
  const { data: farm } = await supabase
    .from("farms")
    .select("name")
    .eq("id", farmId)
    .maybeSingle();
  const stock: Record<string, boolean> = {};
  const { data: stockRows } = await supabase
    .from("listing_stock")
    .select("listing_id, in_stock");
  for (const s of stockRows ?? []) {
    stock[s.listing_id as string] = s.in_stock as boolean;
  }

  return (
    <SalesDashboard
      farmId={farmId}
      boosts={boosts}
      farmName={(farm as { name: string } | null)?.name ?? null}
      stock={stock}
    />
  );
}
