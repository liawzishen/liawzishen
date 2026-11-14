import { Link } from "@/components/ui/Link";
import { Skeleton } from "@/components/ui/Skeleton";
import { getWeatherForFarm } from "@/lib/farm/fetch";
import { weatherEmoji } from "@/lib/weather/fetch";
import { wateringAdvice } from "@/lib/weather/advice";
import { getDict } from "@/lib/i18n/server";

/**
 * Home's one-line weather advisory. An async Server Component rendered inside
 * <Suspense>: the forecast comes from Open-Meteo, which can be slow, so the
 * rest of Home is sent first and this row streams in when it is ready.
 */
export async function WeatherAdvisory({ farmId }: { farmId: string }) {
  const [weather, t] = await Promise.all([getWeatherForFarm(farmId), getDict()]);
  if (!weather) return null;
  const advice = wateringAdvice(weather.today);

  return (
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
          className="block truncate text-[13px] font-bold"
          style={{ color: advice.color }}
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
      <span className="shrink-0 text-[12px] font-semibold text-brand">
        {t.home.forecast} ›
      </span>
    </Link>
  );
}

/** Same outer size as the advisory row, so nothing jumps when it arrives. */
export function WeatherAdvisorySkeleton() {
  return <Skeleton className="mt-4 h-[64px] w-full rounded-card" />;
}
