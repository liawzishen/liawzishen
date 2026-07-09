import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getFarmBundle, getUserAndFarms } from "@/lib/farm/fetch";
import { FarmSwitcher } from "@/components/farm/FarmSwitcher";
import { TodaysTasks, type TaskItem } from "@/components/home/TodaysTasks";
import { getFarmWeather, weatherEmoji } from "@/lib/weather/fetch";
import { wateringAdvice } from "@/lib/weather/advice";
import type { EventType } from "@/types/database";

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function relative(dateStr: string): string {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  planted: { icon: "🌱", label: "Planted" },
  water: { icon: "💧", label: "Watered" },
  fertilize: { icon: "🌿", label: "Fertilized" },
  ai_scan: { icon: "🔬", label: "AI Scan" },
  note: { icon: "📝", label: "Note" },
  harvested: { icon: "🧺", label: "Harvested" },
};

export default async function FarmHomePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const [bundle, { user, farms }] = await Promise.all([
    getFarmBundle(farmId),
    getUserAndFarms(),
  ]);
  if (!bundle) notFound();
  const { farm, plants, care } = bundle;

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const farmerName =
    typeof meta.name === "string" && meta.name.trim() ? meta.name : "there";

  const active = plants.filter((p) => p.lifecycle_status === "active");
  const activeIds = active.map((p) => p.id);
  const nameById = new Map(plants.map((p) => [p.id, p.name]));
  const today = new Date().toISOString().slice(0, 10);

  // Last water/fertilize per plant comes with the bundle (same data its live
  // health scores were computed from) — only the activity feed needs a query.
  // Weather is bounded by a timeout in getFarmWeather, so it can't hang Home.
  const supabase = await createClient();
  const [{ data: feed }, weather] = await Promise.all([
    supabase
      .from("growth_logs")
      .select("plant_id, event_type, note, created_at")
      .in("plant_id", activeIds)
      .order("created_at", { ascending: false })
      .limit(20),
    getFarmWeather(farm),
  ]);
  const advice = wateringAdvice(weather.today);

  // Quick stats
  const healthy = active.filter(
    (p) => p.health_score !== null && p.health_score >= 70
  ).length;
  const needCare = active.filter(
    (p) => p.health_score !== null && p.health_score < 70
  ).length;
  const harvestReadyCount = active.filter(
    (p) => p.expected_harvest_date && p.expected_harvest_date <= today
  ).length;

  // Task groups
  const harvest: TaskItem[] = [];
  const water: TaskItem[] = [];
  const fertilize: TaskItem[] = [];
  for (const p of active) {
    if (p.expected_harvest_date && p.expected_harvest_date <= today) {
      harvest.push({ plantId: p.id, plantName: p.name, sub: `Ready since ${p.expected_harvest_date}` });
    }
    const lw = care.lastWater.get(p.id);
    if (lw ? daysSince(lw) >= 3 : daysSince(p.plant_date) >= 2) {
      water.push({ plantId: p.id, plantName: p.name, sub: lw ? `Last watered ${daysSince(lw)}d ago` : "Not watered yet" });
    }
    const lf = care.lastFertilize.get(p.id);
    if (lf ? daysSince(lf) >= 14 : daysSince(p.plant_date) >= 7) {
      fertilize.push({ plantId: p.id, plantName: p.name, sub: lf ? `Last fertilized ${daysSince(lf)}d ago` : "Not fertilized yet" });
    }
  }
  const totalTasks = harvest.length + water.length + fertilize.length;

  const feedItems = (feed ?? []) as {
    plant_id: string;
    event_type: EventType;
    note: string | null;
    created_at: string;
  }[];

  const stats = [
    { label: "Plants", value: active.length, color: "#1E434A" },
    { label: "Healthy", value: healthy, color: "#0DB074" },
    { label: "Need Care", value: needCare, color: "#F59E0B" },
    { label: "Harvest", value: harvestReadyCount, color: "#3B82F6" },
  ];

  return (
    <main className="px-5 pt-12">
      {/* Greeting */}
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        {new Date().toLocaleDateString("en-MY", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">
        Hi, {farmerName} 👋
      </h1>
      <FarmSwitcher
        farms={farms}
        currentId={farmId}
        currentName={farm.name}
        className="text-[14px] font-medium text-secondary"
      />

      {/* Quick stats — a summary of the farm's state; taps through to the
          Map tab, which owns the full KPI breakdown and analysis. */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={`/farms/${farmId}/field`}
            className="rounded-card p-3 text-center glass active:opacity-80"
          >
            <p
              className="text-[22px] font-bold leading-none"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-secondary">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Today's weather advisory — one glance before the task list */}
      <Link
        href={`/farms/${farmId}/field`}
        className="mt-4 flex items-center gap-2.5 rounded-card px-3.5 py-3 glass"
        style={{ boxShadow: `inset 3px 0 0 ${advice.color}` }}
      >
        <span className="text-[18px] leading-none" aria-hidden>
          {advice.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[13px] font-bold"
            style={{ color: advice.color }}
          >
            {advice.title}
            {weather.source === "fallback" ? " · sample data" : ""}
          </span>
          <span className="block truncate text-[12px] text-secondary">
            {weather.today.tempMax !== null
              ? `${Math.round(weather.today.tempMax)}°C`
              : "—"}{" "}
            ·{" "}
            {weather.today.rainProb !== null
              ? `${Math.round(weather.today.rainProb)}% rain`
              : "—"}{" "}
            ·{" "}
            {weather.today.soilMoisture !== null
              ? `soil ${Math.round(weather.today.soilMoisture * 100)}%`
              : "soil —"}{" "}
            {weatherEmoji(weather.today.weatherCode)}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-brand">
          Forecast ›
        </span>
      </Link>

      {/* Today's tasks */}
      <div className="mb-2 mt-7 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Today&apos;s Tasks
        </h2>
        {totalTasks > 0 && (
          <span className="text-[12px] font-medium text-secondary">
            {totalTasks} to do
          </span>
        )}
      </div>
      <TodaysTasks groups={{ harvest, water, fertilize }} farmId={farmId} />

      {/* Sales summary (placeholder) */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Sales
      </h2>
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">Your Harvest, Sold</p>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: "Products Sold", v: "—" },
            { label: "Active Listings", v: "—" },
            { label: "Revenue", v: "—" },
          ].map((x) => (
            <div key={x.label} className="rounded-input bg-fill p-3 text-center">
              <p className="text-[18px] font-bold text-secondary">{x.v}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-secondary">
                {x.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-secondary">
          List your harvest and track orders here in a later phase.
        </p>
      </Card>

      {/* Recent activity */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Recent Activity
      </h2>
      {feedItems.length === 0 ? (
        <Card className="text-center text-[14px] text-secondary">
          No activity yet — log care or run a scan to get started.
        </Card>
      ) : (
        <Card className="p-0">
          {/* ~5 rows visible; the rest scroll inside the card */}
          <div className="max-h-[340px] overflow-y-auto [scrollbar-width:thin]">
          {feedItems.map((f, i) => {
            const m = EVENT_META[f.event_type] ?? { icon: "•", label: f.event_type };
            // Older task completions stored a note that just repeats the
            // label ("Watered" under "Watered") — hide those, keep real notes.
            const note =
              f.note && f.note.trim().toLowerCase() !== m.label.toLowerCase()
                ? f.note
                : null;
            return (
              <Link
                key={i}
                href={`/farms/${farmId}/plants/${f.plant_id}`}
                className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[16px]">
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {nameById.get(f.plant_id) ?? "Plant"} · {m.label}
                  </p>
                  {note && (
                    <p className="truncate text-[12px] text-secondary">{note}</p>
                  )}
                </div>
                <span className="shrink-0 text-[12px] text-secondary">
                  {relative(f.created_at)}
                </span>
              </Link>
            );
          })}
          </div>
        </Card>
      )}
    </main>
  );
}
