import { Suspense } from "react";
import { Link } from "@/components/ui/Link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  getFarmActivity,
  getFarmBundle,
  getUserAndFarms,
  getWeatherForFarm,
  preload,
} from "@/lib/farm/fetch";
import { displayName } from "@/lib/auth/claims";
import { FarmSwitcher } from "@/components/farm/FarmSwitcher";
import { TodaysTasks, type TaskItem } from "@/components/home/TodaysTasks";
import {
  WeatherAdvisory,
  WeatherAdvisorySkeleton,
} from "@/components/home/WeatherAdvisory";
import { APP_TIME_ZONE, localDateISO } from "@/lib/date";
import { getDict, getLang } from "@/lib/i18n/server";
import { daysSince } from "@/lib/health/calculate";
import type { EventType } from "@/types/database";

/** Rows shown in the Recent Activity feed. */
const FEED_LIMIT = 20;

function relative(dateStr: string): string {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Event icons — the labels come from the i18n dictionary at render time. */
const EVENT_ICON: Record<EventType, string> = {
  planted: "🌱",
  water: "💧",
  fertilize: "🌿",
  ai_scan: "🔬",
  note: "📝",
  harvested: "🧺",
};

export default async function FarmHomePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  // One Promise.all, two waves of round trips: the farm + its plants, then
  // everything keyed by plant id (live health scores and the activity feed
  // run side by side). The last water/fertilize per plant comes with the
  // bundle. Weather is NOT awaited here — <WeatherAdvisory> streams it in, so
  // a slow forecast never delays the page. It is only started early.
  preload(getWeatherForFarm(farmId));
  const [bundle, feedItems, { user, farms }, t, lang] = await Promise.all([
    getFarmBundle(farmId),
    getFarmActivity(farmId, FEED_LIMIT),
    getUserAndFarms(),
    getDict(),
    getLang(),
  ]);
  if (!bundle) notFound();
  const { farm, plants, care } = bundle;
  const dateLocale = lang === "ms" ? "ms-MY" : "en-MY";
  const farmerName = displayName(user, "there");

  const active = plants.filter((p) => p.lifecycle_status === "active");
  const nameById = new Map(plants.map((p) => [p.id, p.name]));
  const today = localDateISO();

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
      harvest.push({ plantId: p.id, plantName: p.name, sub: t.home.readySince(p.expected_harvest_date) });
    }
    const lw = care.lastWater.get(p.id);
    if (lw ? daysSince(lw) >= 3 : daysSince(p.plant_date) >= 2) {
      water.push({ plantId: p.id, plantName: p.name, sub: lw ? t.home.lastWateredAgo(daysSince(lw)) : t.home.notWateredYet });
    }
    const lf = care.lastFertilize.get(p.id);
    if (lf ? daysSince(lf) >= 14 : daysSince(p.plant_date) >= 7) {
      fertilize.push({ plantId: p.id, plantName: p.name, sub: lf ? t.home.lastFertilizedAgo(daysSince(lf)) : t.home.notFertilizedYet });
    }
  }
  const totalTasks = harvest.length + water.length + fertilize.length;

  const stats = [
    { label: t.home.stats.plants, value: active.length, color: "#1E434A" },
    { label: t.home.stats.healthy, value: healthy, color: "#0DB074" },
    { label: t.home.stats.needCare, value: needCare, color: "#F59E0B" },
    { label: t.home.stats.harvest, value: harvestReadyCount, color: "#3B82F6" },
  ];

  return (
    <main className="px-5 pt-12 lg:mx-auto lg:w-full lg:max-w-[1200px] lg:px-8 lg:pt-10">
      {/* Greeting */}
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        {new Date().toLocaleDateString(dateLocale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: APP_TIME_ZONE,
        })}
      </p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">
        {t.home.hi(farmerName)}
      </h1>
      <FarmSwitcher
        farms={farms}
        currentId={farmId}
        currentName={farm.name}
        className="text-[14px] font-medium text-secondary"
      />

      <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
        <div className="min-w-0">

      {/* Quick stats — a summary of the farm's state; taps through to the
          Map tab, which owns the full KPI breakdown and analysis. */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={`/farms/${farmId}/field`}
            className="pressable rounded-card p-3 text-center glass"
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

      {/* Today's weather advisory — one glance before the task list.
          Streamed: the skeleton holds its place until the forecast arrives. */}
      <Suspense fallback={<WeatherAdvisorySkeleton />}>
        <WeatherAdvisory farmId={farmId} />
      </Suspense>

      {/* Today's tasks */}
      <div className="mb-2 mt-7 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
          {t.home.todaysTasks}
        </h2>
        {totalTasks > 0 && (
          <span className="text-[12px] font-medium text-secondary">
            {t.home.toDo(totalTasks)}
          </span>
        )}
      </div>
      <TodaysTasks groups={{ harvest, water, fertilize }} farmId={farmId} />

        </div>

        <div className="min-w-0">

      {/* Sales — one slim row, not a dashboard card. On a phone in the field
          the sales preview was decoration; the Sales tab owns the detail. */}
      <Link
        href={`/farms/${farmId}/sales`}
        className="pressable mt-7 lg:mt-0 flex items-center gap-3 rounded-card p-4 glass"
      >
        <span className="text-[18px]" aria-hidden>
          🛒
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
          {t.home.salesPreviewRow}
        </span>
        <Badge tone="warning">{t.common.preview}</Badge>
        <span className="text-tertiary">›</span>
      </Link>

      {/* Recent activity */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        {t.home.recentActivity}
      </h2>
      {feedItems.length === 0 ? (
        <Card className="text-center text-[14px] text-secondary">
          {t.home.noActivity}
        </Card>
      ) : (
        <Card className="p-0">
          {/* ~5 rows visible; the rest scroll inside the card */}
          <div className="max-h-[340px] overflow-y-auto [scrollbar-width:thin] lg:max-h-[480px]">
          {feedItems.map((f, i) => {
            const icon = EVENT_ICON[f.event_type] ?? "•";
            const label = t.home.events[f.event_type] ?? f.event_type;
            // Older task completions stored a note that just repeats the
            // (English) label ("Watered" under "Watered") — hide those.
            const note =
              f.note &&
              !["watered", "fertilized"].includes(f.note.trim().toLowerCase())
                ? f.note
                : null;
            return (
              <Link
                key={i}
                href={`/farms/${farmId}/plants/${f.plant_id}`}
                className={`pressable flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[16px]">
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {nameById.get(f.plant_id) ?? "Plant"} · {label}
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
        </div>
      </div>
    </main>
  );
}
