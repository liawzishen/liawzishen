import { notFound, redirect } from "next/navigation";
import { getPlantHarvestState } from "@/lib/plant/queries";
import { TopNav } from "@/components/layout/TopNav";
import { HarvestConfirm } from "@/components/passport/HarvestConfirm";

export default async function HarvestPassportPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const plant = await getPlantHarvestState(plantId);
  if (!plant) notFound();

  // Already harvested → jump straight to its passport.
  if (plant.harvested && plant.passportToken) {
    redirect(`/passport/${plant.passportToken}`);
  }

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Harvest" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <HarvestConfirm plantId={plantId} plantName={plant.name} />
    </main>
  );
}
