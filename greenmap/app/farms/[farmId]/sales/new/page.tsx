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
    <main
      id="main-content"
      className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"
    >
      <TopNav title="List a Harvest" backHref={`/farms/${farmId}/sales`} />
      <ListHarvestForm farmId={farmId} />
    </main>
  );
}
