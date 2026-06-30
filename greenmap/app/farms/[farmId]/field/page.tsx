import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { FarmMap } from "@/components/farm/FarmMap";
import { KpiStrip } from "@/components/farm/KpiStrip";
import { FarmSwitcher } from "@/components/farm/FarmSwitcher";
import { getFarmBundle } from "@/lib/farm/fetch";

/**
 * Map tab — the farm's interactive map (KPI strip + plant markers). This is a
 * tab-root screen (renders the AppShell tab bar, no back arrow). Switching
 * farms happens via the FarmSwitcher in the header, not a separate list.
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: farms } = await supabase
    .from("farms")
    .select("id, name")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const active = plants.filter((p) => p.lifecycle_status === "active");
  const today = new Date().toISOString().slice(0, 10);
  const inBand = (lo: number, hi: number) =>
    active.filter(
      (p) =>
        p.health_score !== null && p.health_score >= lo && p.health_score <= hi
    ).length;
  const ready = active.filter(
    (p) => p.expected_harvest_date && p.expected_harvest_date <= today
  ).length;

  return (
    <AppShell farmId={farmId}>
      <main className="px-5 pt-12">
        <FarmSwitcher
          farms={(farms ?? []) as { id: string; name: string }[]}
          currentId={farmId}
          currentName={farm.name}
          className="text-[26px] font-bold leading-tight"
        />
        <p className="mt-0.5 text-[14px] capitalize text-secondary">
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
      </main>
    </AppShell>
  );
}
