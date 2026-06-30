import { TopNav } from "@/components/layout/TopNav";
import { Marketplace } from "@/components/sales/Marketplace";

/**
 * Sales · Marketplace (simulated buyer browse). Pushed sub-page of the Sales
 * tab; cards link to the listing detail. No real checkout or persistence.
 */
export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  return (
    <main className="pb-12">
      <TopNav title="Marketplace" backHref={`/farms/${farmId}/sales`} />
      <Marketplace farmId={farmId} />
    </main>
  );
}
