import {
  SOIL_DRY_THRESHOLD,
  type DailyWeather,
} from "@/lib/weather/fetch";
import { getDict } from "@/lib/i18n/server";

/**
 * Desktop side-panel charts — dependency-free inline SVG (same approach as
 * HealthTrendChart): 9 days (2 past + today + 6 forecast) of temperature and
 * of soil moisture + rain probability. Server-renderable.
 */

const W = 340;
const H = 130;
const PAD_X = 14;
const PAD_TOP = 12;
const PAD_BOTTOM = 24; // room for weekday labels

function xAt(i: number, n: number) {
  return PAD_X + (i / (n - 1)) * (W - 2 * PAD_X);
}

/** Build an SVG path through the non-null points of a series. */
function linePath(
  values: (number | null)[],
  y: (v: number) => number
): string {
  let d = "";
  values.forEach((v, i) => {
    if (v === null) return;
    const cmd = d === "" ? "M" : "L";
    d += `${cmd}${xAt(i, values.length).toFixed(1)},${y(v).toFixed(1)} `;
  });
  return d.trim();
}

function DayAxis({
  days,
  todayLabel,
}: {
  days: DailyWeather[];
  todayLabel: string;
}) {
  return (
    <>
      {days.map((d, i) => (
        <text
          key={d.date}
          x={xAt(i, days.length)}
          y={H - 8}
          textAnchor="middle"
          fontSize={9}
          fontWeight={d.isToday ? 700 : 500}
          fill="currentColor"
          opacity={d.isToday ? 0.95 : d.isPast ? 0.4 : 0.65}
        >
          {d.isToday ? todayLabel : d.weekday}
        </text>
      ))}
    </>
  );
}

function TodayDivider({ days }: { days: DailyWeather[] }) {
  const i = days.findIndex((d) => d.isToday);
  if (i < 0) return null;
  const x = xAt(i, days.length);
  return (
    <line
      x1={x}
      x2={x}
      y1={PAD_TOP}
      y2={H - PAD_BOTTOM}
      stroke="currentColor"
      strokeOpacity={0.18}
      strokeDasharray="3 4"
    />
  );
}

export async function TemperatureChart({ days }: { days: DailyWeather[] }) {
  const t = await getDict();
  const maxes = days.map((d) => d.tempMax);
  const mins = days.map((d) => d.tempMin);
  const nums = [...maxes, ...mins].filter((v): v is number => v !== null);
  if (nums.length < 2) return <ChartEmpty label={t.weather.temperature} />;

  const lo = Math.floor(Math.min(...nums)) - 2;
  const hi = Math.ceil(Math.max(...nums)) + 2;
  const y = (v: number) =>
    PAD_TOP + (1 - (v - lo) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold">{t.weather.temperature}</h3>
        <p className="text-[11px] text-secondary">
          <span className="font-semibold text-warning-ink">● {t.weather.max}</span>
          <span className="ml-2 font-semibold text-info-ink">● {t.weather.min}</span> °C
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full text-secondary"
        role="img"
        aria-label="9-day temperature trend, maximum and minimum"
      >
        <TodayDivider days={days} />
        {/* scale hints */}
        <text x={PAD_X} y={PAD_TOP + 4} fontSize={9} fill="currentColor" opacity={0.5}>
          {hi}°
        </text>
        <text x={PAD_X} y={H - PAD_BOTTOM} fontSize={9} fill="currentColor" opacity={0.5}>
          {lo}°
        </text>
        <path d={linePath(maxes, y)} fill="none" stroke="#ff9f0a" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath(mins, y)} fill="none" stroke="#007aff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        {days.map((d, i) => (
          <g key={d.date}>
            {d.tempMax !== null && (
              <circle cx={xAt(i, days.length)} cy={y(d.tempMax)} r={d.isToday ? 3.4 : 2.4} fill="#ff9f0a" />
            )}
            {d.tempMin !== null && (
              <circle cx={xAt(i, days.length)} cy={y(d.tempMin)} r={d.isToday ? 3.4 : 2.4} fill="#007aff" />
            )}
          </g>
        ))}
        <DayAxis days={days} todayLabel={t.weather.today} />
      </svg>
    </section>
  );
}

export async function MoistureRainChart({ days }: { days: DailyWeather[] }) {
  const t = await getDict();
  const moist = days.map((d) => d.soilMoisture);
  const moistNums = moist.filter((v): v is number => v !== null);
  if (moistNums.length < 2) return <ChartEmpty label={t.weather.soilMoisture} />;

  // Moisture on a fixed 0–0.45 m³/m³ scale (≈ saturation for most soils);
  // rain probability bars on 0–100 % share the same pixel range.
  const MOIST_MAX = 0.45;
  const yM = (v: number) =>
    PAD_TOP + (1 - Math.min(v, MOIST_MAX) / MOIST_MAX) * (H - PAD_TOP - PAD_BOTTOM);
  const yR = (p: number) =>
    PAD_TOP + (1 - p / 100) * (H - PAD_TOP - PAD_BOTTOM);
  const barW = (W - 2 * PAD_X) / days.length / 2.4;

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold">{t.weather.soilAndRain}</h3>
        <p className="text-[11px] text-secondary">
          <span className="font-semibold text-brand">● {t.weather.moisture}</span>
          <span className="ml-2 font-semibold text-info-ink">▮ {t.weather.rainPct}</span>
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full text-secondary"
        role="img"
        aria-label="9-day soil moisture and rain probability"
      >
        {/* rain probability bars */}
        {days.map(
          (d, i) =>
            d.rainProb !== null && (
              <rect
                key={`r-${d.date}`}
                x={xAt(i, days.length) - barW / 2}
                y={yR(d.rainProb)}
                width={barW}
                height={H - PAD_BOTTOM - yR(d.rainProb)}
                rx={2}
                fill="#007aff"
                opacity={d.isPast ? 0.18 : 0.32}
              />
            )
        )}
        <TodayDivider days={days} />
        {/* dry threshold guide */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={yM(SOIL_DRY_THRESHOLD)}
          y2={yM(SOIL_DRY_THRESHOLD)}
          stroke="#ff9f0a"
          strokeOpacity={0.45}
          strokeDasharray="3 4"
        />
        <text
          x={W - PAD_X}
          y={yM(SOIL_DRY_THRESHOLD) - 4}
          textAnchor="end"
          fontSize={9}
          fill="#ff9f0a"
          opacity={0.9}
        >
          {t.weather.dry}
        </text>
        {/* moisture line */}
        <path
          d={linePath(moist, yM)}
          fill="none"
          stroke="#4f772d"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {days.map(
          (d, i) =>
            d.soilMoisture !== null && (
              <circle
                key={`m-${d.date}`}
                cx={xAt(i, days.length)}
                cy={yM(d.soilMoisture)}
                r={d.isToday ? 3.4 : 2.4}
                fill="#4f772d"
              />
            )
        )}
        <DayAxis days={days} todayLabel={t.weather.today} />
      </svg>
    </section>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <section className="rounded-card p-4 glass">
      <div className="flex h-24 items-center justify-center rounded-input bg-fill px-4 text-center text-[13px] text-secondary">
        No {label} data available right now.
      </div>
    </section>
  );
}
