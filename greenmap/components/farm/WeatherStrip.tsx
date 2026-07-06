import { weatherEmoji, type WeatherBundle } from "@/lib/weather/fetch";
import { wateringAdvice } from "@/lib/weather/advice";
import { cn } from "@/lib/utils";

/**
 * Mobile weather strip — one-line watering advisory plus a horizontally
 * scrollable row of day pills (today + forecast). Kept deliberately compact
 * so the map stays the hero of the screen; the full charts are desktop-only.
 */
export function WeatherStrip({ weather }: { weather: WeatherBundle }) {
  const advice = wateringAdvice(weather.today);
  // Today onward — past days matter on the charts, not in a glanceable strip.
  const days = weather.days.filter((d) => !d.isPast);

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-input px-3 py-2"
        style={{ backgroundColor: `${advice.color}1A` }}
      >
        <span className="text-[15px] leading-none" aria-hidden>
          {advice.icon}
        </span>
        <p
          className="min-w-0 truncate text-[12px] font-semibold"
          style={{ color: advice.color }}
        >
          {advice.title}
          {weather.source === "fallback" ? " · sample data" : ""}
        </p>
      </div>

      <div className="-mx-5 mt-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                {d.isToday ? "Today" : d.weekday}
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
