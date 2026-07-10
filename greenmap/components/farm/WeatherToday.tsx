import { weatherEmoji, type WeatherBundle } from "@/lib/weather/fetch";
import { wateringAdvice } from "@/lib/weather/advice";
import { getDict } from "@/lib/i18n/server";

/**
 * Desktop side-panel card: today's conditions at the farm plus the watering
 * advisory. Server-renderable — no client JS. Async so it can read the
 * request's dictionary (cookie-based locale).
 */
export async function WeatherToday({ weather }: { weather: WeatherBundle }) {
  const dict = await getDict();
  const t = weather.today;
  const advice = wateringAdvice(t);
  const moisturePct =
    t.soilMoisture !== null ? Math.round(t.soilMoisture * 100) : null;

  const stats = [
    {
      label: dict.weather.rainChance,
      value: t.rainProb !== null ? `${Math.round(t.rainProb)}%` : "—",
    },
    {
      label: dict.weather.soilMoisture,
      value: moisturePct !== null ? `${moisturePct}%` : "—",
    },
    {
      label: dict.weather.rainfall,
      value: t.precipMm !== null ? `${t.precipMm.toFixed(1)} mm` : "—",
    },
  ];

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">{dict.weather.todayAtFarm}</h2>
          <p className="mt-0.5 truncate text-[12px] text-secondary">
            {weather.locationLabel}
            {weather.source === "fallback" ? ` · ${dict.home.sampleData}` : ""}
          </p>
        </div>
        <span className="text-[32px] leading-none" aria-hidden>
          {weatherEmoji(t.weatherCode)}
        </span>
      </div>

      <p className="mt-2 text-[30px] font-bold leading-none">
        {t.tempMax !== null ? `${Math.round(t.tempMax)}°` : "—"}
        <span className="ml-1.5 text-[16px] font-semibold text-secondary">
          / {t.tempMin !== null ? `${Math.round(t.tempMin)}°` : "—"} C
        </span>
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-input bg-fill px-2 py-2 text-center">
            <p className="text-[14px] font-bold leading-tight">{s.value}</p>
            <p className="mt-0.5 text-[10px] font-medium text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Watering advisory */}
      <div
        className="mt-3 flex items-start gap-2.5 rounded-input px-3 py-2.5"
        style={{ backgroundColor: `${advice.color}1A` }}
      >
        <span className="text-[18px] leading-none" aria-hidden>
          {advice.icon}
        </span>
        <div>
          <p className="text-[13px] font-bold leading-tight" style={{ color: advice.color }}>
            {dict.advice[advice.level].title}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-secondary">
            {dict.advice[advice.level].detail(advice.rainProb)}
          </p>
        </div>
      </div>
    </section>
  );
}
