import { weatherEmoji, type WeatherBundle } from "@/lib/weather/fetch";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * Mobile weather strip for the Map tab — a horizontally scrollable row of
 * day pills (today + forecast). Deliberately data-only: the one-line
 * watering ADVISORY lives on Home (the daily briefing page), so the two
 * tabs don't repeat each other. Kept compact so the map stays the hero.
 */
export async function WeatherStrip({ weather }: { weather: WeatherBundle }) {
  const t = await getDict();
  // Today onward — past days matter on the charts, not in a glanceable strip.
  const days = weather.days.filter((d) => !d.isPast);

  return (
    <div>
      {weather.source === "fallback" && (
        <p className="mb-1.5 text-[11px] font-medium text-secondary">
          {t.weather.offlineSample}
        </p>
      )}
      <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pb-1">
          {days.map((d) => (
            <div
              key={d.date}
              className={cn(
                "w-[64px] shrink-0 rounded-input px-2 py-2 text-center glass",
                d.isToday && "ring-2 ring-brand/50"
              )}
            >
              <p className="text-[10px] font-semibold text-secondary">
                {d.isToday ? t.weather.today : d.weekday}
              </p>
              <p className="mt-0.5 text-[18px] leading-none" aria-hidden>
                {weatherEmoji(d.weatherCode)}
              </p>
              <p className="mt-1 text-[13px] font-bold leading-none">
                {d.tempMax !== null ? `${Math.round(d.tempMax)}°` : "—"}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-info">
                💧{" "}
                {d.soilMoisture !== null
                  ? `${Math.round(d.soilMoisture * 100)}%`
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
