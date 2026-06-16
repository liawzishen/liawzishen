import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { ActivityTimeline } from "@/components/plant/ActivityTimeline";
import type { AiAnalysis, GrowthLog } from "@/types/database";

export default async function PlantActivityPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const supabase = await createClient();

  const { data: plant } = await supabase
    .from("plants")
    .select("name")
    .eq("id", plantId)
    .single();
  if (!plant) notFound();

  const [{ data: logs }, { data: analyses }] = await Promise.all([
    supabase
      .from("growth_logs")
      .select("*")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_analyses")
      .select("*")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false }),
  ]);
  const all = (logs ?? []) as GrowthLog[];
  const analysisRows = (analyses ?? []) as AiAnalysis[];

  return (
    <main className="pb-12">
      <TopNav title="Activity" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <div className="px-6 pt-2">
        <h1 className="text-[22px] font-bold leading-tight">
          {(plant as { name: string }).name}
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
