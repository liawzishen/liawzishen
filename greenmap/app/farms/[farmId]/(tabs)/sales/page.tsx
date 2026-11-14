import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/user";
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

  // The three queries do not depend on each other, so they run together.
  // Only the boosts need the user id, and they start the moment it is known.
  const [boostRows, { data: farm }, { data: stockRows }] = await Promise.all([
    getAuthUser().then(async (user) => {
      if (!user) return [];
      const { data } = await supabase
        .from("listing_boosts")
        .select("listing_id, expires_at")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString());
      return data ?? [];
    }),
    supabase.from("farms").select("name").eq("id", farmId).maybeSingle(),
    // listing_stock may not exist yet → its error is ignored.
    supabase.from("listing_stock").select("listing_id, in_stock"),
  ]);

  const boosts: Record<string, string> = {};
  for (const b of boostRows) {
    if (!boosts[b.listing_id] || boosts[b.listing_id] < b.expires_at) {
      boosts[b.listing_id] = b.expires_at;
    }
  }

  const stock: Record<string, boolean> = {};
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
