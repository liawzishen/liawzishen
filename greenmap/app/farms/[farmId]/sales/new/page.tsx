import { TopNav } from "@/components/layout/TopNav";
import { ListHarvestForm } from "@/components/sales/ListHarvestForm";

/**
 * Sales · List a Harvest (simulated). A pushed sub-page of the Sales tab —
 * reached from "My Sales" and (later) the Harvest Passport "Sell" button.
 */
export default async function ListHarvestPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  return (
    <main className="pb-12">
      <TopNav title="List a Harvest" backHref={`/farms/${farmId}/sales`} />
      <ListHarvestForm farmId={farmId} />
    </main>
  );
}
