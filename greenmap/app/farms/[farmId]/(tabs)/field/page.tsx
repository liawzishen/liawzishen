import { notFound } from "next/navigation";
import { FarmMap } from "@/components/farm/FarmMap";
import { KpiStrip } from "@/components/farm/KpiStrip";
import { FarmSwitcher } from "@/components/farm/FarmSwitcher";
import { FarmHealthTrend } from "@/components/farm/FarmHealthTrend";
import { NeedsCareList } from "@/components/farm/NeedsCareList";
import { UpcomingHarvests } from "@/components/farm/UpcomingHarvests";
import {
  MoistureRainChart,
  TemperatureChart,
} from "@/components/farm/WeatherCharts";
import { WeatherStrip } from "@/components/farm/WeatherStrip";
import { WeatherToday } from "@/components/farm/WeatherToday";
import {
  getFarmAnalytics,
  getFarmBundle,
  getUserAndFarms,
} from "@/lib/farm/fetch";
import { getFarmWeather } from "@/lib/weather/fetch";
import { getDict } from "@/lib/i18n/server";

/**
 * Map tab — the farm's interactive map. Responsive (2026-07-06 map-page
 * spec): below lg it is the familiar phone screen (header → KPI strip →
 * weather strip → map); at lg+ the page escapes the 430px frame
 * (`.desktop-breakout`, see globals.css) into a dashboard — map plus an
 * analysis grid (farm health trend, needs-care, upcoming harvests) on the
 * left, a sticky weather panel on the right.
 *
 * Weather (Open-Meteo) is fetched server-side. Every request is bounded by a
 * timeout in `getFarmWeather`, so a slow or unreachable forecast falls back
 * to sample data within a few seconds instead of hanging the page.
 */
export default async function FarmFieldPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const [bundle, { farms }] = await Promise.all([
    getFarmBundle(farmId),
    getUserAndFarms(),
  ]);
  if (!bundle) notFound();
  const { farm, zones, plants } = bundle;
  const [weather, analytics, t] = await Promise.all([
    getFarmWeather(farm),
    getFarmAnalytics(plants.map((p) => p.id)),
    getDict(),
  ]);

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
    <main className="desktop-breakout mx-auto w-full max-w-[1400px] px-5 pt-12 lg:px-8 lg:pt-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        {/* ── Left column: header + KPIs + map + analysis grid ─────────── */}
        <div className="min-w-0">
          <FarmSwitcher
            farms={farms}
            currentId={farmId}
            currentName={farm.name}
            className="text-[26px] font-bold leading-tight"
          />
          <p className="mt-0.5 text-[14px] capitalize text-secondary">
            {farm.crop_type} · {farm.location} · {t.map.subtitle}
          </p>
          <div className="mt-4">
            <KpiStrip
              total={active.length}
              healthy={inBand(70, 100)}
              attention={inBand(40, 69)}
              critical={inBand(0, 39)}
              ready={ready}
              labels={t.map.kpi}
            />
          </div>

          {/* Mobile only — compact daily weather */}
          <div className="mt-4 lg:hidden">
            <WeatherStrip weather={weather} />
          </div>

          <div className="mt-4">
            <FarmMap
              farm={farm}
              zones={zones}
              initialPlants={plants}
              className="h-[calc(100dvh-360px)] min-h-[300px] lg:h-[calc(100dvh-320px)] lg:min-h-[420px]"
            />
          </div>

          {/* Desktop only — farm analysis grid under the map. (The activity
              feed is deliberately NOT here — Home owns "what happened";
              this tab owns "how is the farm doing".) */}
          <div className="mt-4 hidden gap-4 lg:grid lg:grid-cols-2">
            <div className="lg:col-span-2">
              <FarmHealthTrend points={analytics.healthTrend} />
            </div>
            <NeedsCareList plants={plants} farmId={farmId} />
            <UpcomingHarvests plants={plants} farmId={farmId} />
          </div>
        </div>

        {/* ── Right column (desktop only): sticky weather panel ────────── */}
        <aside
          className="hidden lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-48px)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]"
          aria-label="Farm weather panel"
        >
          <WeatherToday weather={weather} />
          <TemperatureChart days={weather.days} />
          <MoistureRainChart days={weather.days} />
        </aside>
      </div>
    </main>
  );
}
