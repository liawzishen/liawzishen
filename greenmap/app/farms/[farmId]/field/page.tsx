import { notFound } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { FarmMap } from "@/components/farm/FarmMap";
import { KpiStrip } from "@/components/farm/KpiStrip";
import { getFarmBundle } from "@/lib/farm/fetch";

/**
 * Per-farm field view — the KPI strip + interactive map for one farm. Reached
 * by tapping a farm on the Map tab; the TopNav back arrow returns to that list.
 */
export default async function FarmFieldPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const bundle = await getFarmBundle(farmId);
  if (!bundle) notFound();
  const { farm, zones, plants } = bundle;

  const active = plants.filter((p) => p.lifecycle_status === "active");
  const today = new Date().toISOString().slice(0, 10);
  const inBand = (lo: number, hi: number) =>
    active.filter(
      (p) => p.health_score !== null && p.health_score >= lo && p.health_score <= hi
    ).length;
  const ready = active.filter(
    (p) => p.expected_harvest_date && p.expected_harvest_date <= today
  ).length;

  return (
    <main className="pb-12">
      <TopNav title={farm.name} backHref={`/farms/${farmId}/map`} />
      <div className="px-5 pt-2">
        <p className="text-[14px] capitalize text-secondary">
          {farm.crop_type} · {farm.location} · tap a marker for details
        </p>
        <div className="mt-4">
          <KpiStrip
            total={active.length}
            healthy={inBand(70, 100)}
            attention={inBand(40, 69)}
            critical={inBand(0, 39)}
            ready={ready}
          />
        </div>
        <div className="mt-4">
          <FarmMap farm={farm} zones={zones} initialPlants={plants} />
        </div>
      </div>
    </main>
  );
}
