import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { healthDisplay } from "@/lib/health/display";
import { liveScoresForPlants } from "@/lib/health/live";
import { HealthTrendChart } from "@/components/plant/HealthTrendChart";
import { ActivityTimeline } from "@/components/plant/ActivityTimeline";
import { ManualStatusControl } from "@/components/plant/ManualStatusControl";
import { PlantQuickActions } from "@/components/plant/PlantQuickActions";
import { SuggestionCard } from "@/components/plant/SuggestionCard";
import type { AiAnalysis, GrowthLog, Plant, Zone } from "@/types/database";

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const supabase = await createClient();

  const { data: plant } = await supabase
    .from("plants")
    .select("*")
    .eq("id", plantId)
    .single();
  if (!plant) notFound();
  const p = plant as Plant;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [
    { data: zoneRow },
    live,
    { data: history },
    { data: logs },
    { data: analyses },
  ] = await Promise.all([
    p.zone_id
      ? supabase.from("zones").select("*").eq("id", p.zone_id).single()
      : Promise.resolve({ data: null }),
    liveScoresForPlants(supabase, [p]),
    supabase
      .from("health_score_history")
      .select("score, created_at")
      .eq("plant_id", plantId)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true }),
    supabase
      .from("growth_logs")
      .select("*")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("ai_analyses")
      .select("*")
      .eq("plant_id", plantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const zone = (zoneRow as Zone | null) ?? null;
  const liveScore = live.get(p.id) ?? p.health_score;
  const display = healthDisplay(liveScore);
  const points = (history ?? []) as { score: number; created_at: string }[];
  const recentLogs = (logs ?? []) as GrowthLog[];
  const analysisRows = (analyses ?? []) as AiAnalysis[];

  const badgeTone =
    display.band === "healthy"
      ? "brand"
      : display.band === "attention"
        ? "warning"
        : display.band === "critical"
          ? "critical"
          : "neutral";

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Plant Detail" backHref={`/farms/${farmId}/field`} />

      <div className="px-6 pt-2">
        {/* Header */}
        <h1 className="text-[28px] font-bold leading-tight">{p.name}</h1>
        <p className="mt-0.5 text-[14px] text-secondary">
          {p.type}
          {zone ? ` · ${zone.name}` : ""}
          {p.lifecycle_status === "harvested" ? " · Harvested" : ""}
        </p>

        {/* Health score (live / passive-decayed) */}
        <Card className="mt-5 text-center">
          <p className="text-[13px] uppercase tracking-wide text-secondary">
            Health Score
          </p>
          <p className={`mt-1 text-[48px] font-bold leading-none ${display.textClass}`}>
            {liveScore === null ? "—" : `${liveScore}%`}
          </p>
          <div className="mt-2 flex justify-center">
            <Badge tone={badgeTone}>{display.label}</Badge>
          </div>
          {liveScore === null && (
            <p className="mt-2 text-[13px] text-secondary">
              Run an AI scan or log care to generate a score.
            </p>
          )}
        </Card>

        {/* AI suggestion */}
        <SuggestionCard plantId={p.id} />

        {/* 7-day trend */}
        <Card className="mt-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
            7-Day Trend
          </p>
          <HealthTrendChart points={points} />
        </Card>

        {/* Manual status */}
        <Card className="mt-4">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary">
            Set Status
          </p>
          <ManualStatusControl plantId={p.id} current={p.manual_status} />
          <p className="mt-2 text-[12px] text-secondary">
            Your read on the plant — factored into the health score (15%).
          </p>
        </Card>

        {/* Info rows */}
        <Card className="mt-4 p-0">
          {[
            { label: "Planted", value: p.plant_date },
            {
              label: "Expected Harvest",
              value: p.expected_harvest_date ?? "Not set",
            },
            { label: "Days Since Planted", value: `${daysSince(p.plant_date)} days` },
          ].map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between p-4 ${i > 0 ? "hairline-t" : ""}`}
            >
              <span className="text-[15px] text-secondary">{row.label}</span>
              <span className="text-[15px] font-medium">{row.value}</span>
            </div>
          ))}
        </Card>

        {/* Quick actions (functional — log + recalculate) */}
        <p className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Quick Actions
        </p>
        <PlantQuickActions
          plant={p}
          scanHref={`/farms/${farmId}/plants/${plantId}/scan`}
        />

        {/* Activity */}
        <div className="mb-2 mt-6 flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
            Activity
          </p>
          {recentLogs.length > 0 && (
            <Link
              href={`/farms/${farmId}/plants/${plantId}/activity`}
              className="text-[13px] font-semibold text-brand"
            >
              View all
            </Link>
          )}
        </div>
        <Card>
          <ActivityTimeline logs={recentLogs} analyses={analysisRows} />
        </Card>

        {/* Harvest button (wired in Phase 7) */}
        <Link
          href={`/farms/${farmId}/plants/${plantId}/harvest`}
          className={`mt-6 block w-full rounded-btn py-3 text-center text-[15px] font-semibold ${
            p.lifecycle_status === "harvested"
              ? "bg-fill text-brand"
              : "bg-brand text-white"
          }`}
        >
          {p.lifecycle_status === "harvested"
            ? "View Harvest Passport"
            : "Mark as Harvested"}
        </Link>
      </div>
    </main>
  );
}
