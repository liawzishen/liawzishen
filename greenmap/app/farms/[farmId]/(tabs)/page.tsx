import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getFarmBundle, getUserAndFarms } from "@/lib/farm/fetch";
import { FarmSwitcher } from "@/components/farm/FarmSwitcher";
import { TodaysTasks, type TaskItem } from "@/components/home/TodaysTasks";
import { getFarmWeather, weatherEmoji } from "@/lib/weather/fetch";
import { wateringAdvice, type AdviceLevel } from "@/lib/weather/advice";
import { getDict, getLang } from "@/lib/i18n/server";
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

/**
 * Advisory TEXT colour. `advice.color` is a FILL value — it drives the inset
 * accent bar, where a large block of colour only owes 3:1 — but as text those
 * bright hues sit under 2:1 on the glass card. The headline takes the matching
 * ink token instead.
 */
const ADVICE_TEXT_CLASS: Record<AdviceLevel, string> = {
  skip: "text-info-ink",
  good: "text-brand-dark",
  water: "text-warning-ink",
  urgent: "text-critical-ink",
};

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
  const [bundle, { user, farms }, t, lang] = await Promise.all([
    getFarmBundle(farmId),
    getUserAndFarms(),
    getDict(),
    getLang(),
  ]);
  if (!bundle) notFound();
  const { farm, plants, care } = bundle;
  const dateLocale = lang === "ms" ? "ms-MY" : "en-MY";

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

  const feedItems = (feed ?? []) as {
    plant_id: string;
    event_type: EventType;
    note: string | null;
    created_at: string;
  }[];

  // Stat colours are TEXT, so they use the ink tokens rather than the bright
  // iOS fills these tiles used to carry (#F59E0B measured 1.9:1 on glass).
  const stats = [
    { label: t.home.stats.plants, value: active.length, className: "text-label" },
    { label: t.home.stats.healthy, value: healthy, className: "text-brand-dark" },
    { label: t.home.stats.needCare, value: needCare, className: "text-warning-ink" },
    { label: t.home.stats.harvest, value: harvestReadyCount, className: "text-info-ink" },
  ];

  return (
    <main
      id="main-content"
      className="px-5 pt-12 lg:mx-auto lg:w-full lg:max-w-[1200px] lg:px-8 lg:pt-10"
    >
      {/* Greeting */}
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        {new Date().toLocaleDateString(dateLocale, {
          weekday: "long",
          day: "numeric",
          month: "long",
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
            <p className={`text-[22px] font-bold leading-none ${s.className}`}>
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
        className="pressable mt-4 flex items-center gap-2.5 rounded-card px-3.5 py-3 glass"
        style={{ boxShadow: `inset 3px 0 0 ${advice.color}` }}
      >
        <span className="text-[18px] leading-none" aria-hidden>
          {advice.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[13px] font-bold ${ADVICE_TEXT_CLASS[advice.level]}`}
          >
            {t.advice[advice.level].title}
            {weather.source === "fallback" ? ` · ${t.home.sampleData}` : ""}
          </span>
          <span className="block truncate text-[12px] text-secondary">
            {weather.today.tempMax !== null
              ? `${Math.round(weather.today.tempMax)}°C`
              : "—"}{" "}
            ·{" "}
            {weather.today.rainProb !== null
              ? `${Math.round(weather.today.rainProb)}% ${t.home.rain}`
              : "—"}{" "}
            ·{" "}
            {weather.today.soilMoisture !== null
              ? `${t.home.soil} ${Math.round(weather.today.soilMoisture * 100)}%`
              : `${t.home.soil} —`}{" "}
            {weatherEmoji(weather.today.weatherCode)}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-brand-dark">
          {t.home.forecast} ›
        </span>
      </Link>

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
        <span aria-hidden className="text-tertiary">
          ›
        </span>
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
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[16px]"
                >
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
