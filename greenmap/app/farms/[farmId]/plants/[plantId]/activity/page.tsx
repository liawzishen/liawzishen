import { notFound } from "next/navigation";
import { getPlantActivity } from "@/lib/plant/queries";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { ActivityTimeline } from "@/components/plant/ActivityTimeline";

export default async function PlantActivityPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const activity = await getPlantActivity(plantId);
  if (!activity) notFound();
  const { name, logs: all, analyses: analysisRows } = activity;

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Activity" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <div className="px-6 pt-2">
        <h1 className="text-[22px] font-bold leading-tight">
          {name}
        </h1>
        <p className="mt-0.5 text-[14px] text-secondary">
          {all.length} event{all.length === 1 ? "" : "s"}
        </p>
        <Card className="mt-4">
          <ActivityTimeline logs={all} analyses={analysisRows} />
        </Card>
      </div>
    </main>
  );
}
