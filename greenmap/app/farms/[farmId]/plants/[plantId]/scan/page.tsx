import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { ScanUploader } from "@/components/ai/ScanUploader";

export default async function PlantScanPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const supabase = await createClient();

  const { data: plant } = await supabase
    .from("plants")
    .select("name, type")
    .eq("id", plantId)
    .single();
  if (!plant) notFound();
  const p = plant as { name: string; type: string };

  return (
    <main className="pb-12">
      <TopNav title="AI Scan" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <div className="px-6 pt-2">
        <h1 className="text-[24px] font-bold leading-tight">{p.name}</h1>
        <p className="mt-0.5 text-[14px] text-secondary">
          Snap a leaf for an instant Gemini health check.
        </p>
        <div className="mt-4">
          <ScanUploader plantId={plantId} farmId={farmId} cropType={p.type} />
        </div>
      </div>
    </main>
  );
}
