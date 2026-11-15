import { getSalesOverview } from "@/lib/marketplace/availability";
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
  const { boosts, farmName, stock } = await getSalesOverview(farmId);

  return (
    <SalesDashboard
      farmId={farmId}
      boosts={boosts}
      farmName={farmName}
      stock={stock}
    />
  );
}
