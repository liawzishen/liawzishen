import { healthDisplay } from "@/lib/health/display";
import { getDict } from "@/lib/i18n/server";
import type { FarmHealthPoint } from "@/lib/farm/fetch";

/**
 * Desktop dashboard card: 14-day farm-wide average health — every
 * health_score_history snapshot across all plants, averaged per day.
 * Same dependency-free SVG style as the plant-level HealthTrendChart.
 */
export async function FarmHealthTrend({ points }: { points: FarmHealthPoint[] }) {
  const t = await getDict();
  const latest = points.length > 0 ? points[points.length - 1].avg : null;
  const color = healthDisplay(latest).color;

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold">{t.map.panels.farmHealth}</h3>
        {latest !== null && (
          <span className="text-[13px] font-bold" style={{ color }}>
            {t.map.panels.avg} {latest}
          </span>
        )}
      </div>

      {points.length < 2 ? (
        <p className="mt-3 rounded-input bg-fill px-3 py-3 text-center text-[13px] text-secondary">
          {t.map.panels.notEnoughHistory}
        </p>
      ) : (
        <Chart points={points} color={color} />
      )}
    </section>
  );
}

function Chart({ points, color }: { points: FarmHealthPoint[]; color: string }) {
  const W = 340;
  const H = 120;
  const padX = 14;
  const padTop = 10;
  const padBottom = 22;
  const x = (i: number) => padX + (i / (points.length - 1)) * (W - 2 * padX);
  const y = (s: number) => padTop + (1 - s / 100) * (H - padTop - padBottom);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(H - padBottom).toFixed(1)} L${x(0).toFixed(1)},${(H - padBottom).toFixed(1)} Z`;

  // Label at most ~5 dates so the axis never crowds.
  const step = Math.max(1, Math.ceil(points.length / 5));

  // The label has to carry the reading, not just name the chart — "14-day
  // farm average health trend" told a screen-reader user nothing about
  // whether the farm is improving.
  const first = Math.round(points[0].avg);
  const last = Math.round(points[points.length - 1].avg);
  const delta = last - first;
  const direction =
    delta > 0 ? `up ${delta}` : delta < 0 ? `down ${Math.abs(delta)}` : "unchanged";
  const summary = `14-day farm average health trend: ${first} to ${last} out of 100, ${direction}.`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 w-full text-secondary"
      role="img"
      aria-label={summary}
    >
      {[70, 40].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={W - padX}
          y1={y(g)}
          y2={y(g)}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeDasharray="3 4"
        />
      ))}
      <path d={area} fill={color} opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.avg)} r={2.6} fill={color} />
      ))}
      {points.map(
        (p, i) =>
          (i % step === 0 || i === points.length - 1) && (
            <text
              key={`t-${p.date}`}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              opacity={0.55}
            >
              {p.date.slice(5).replace("-", "/")}
            </text>
          )
      )}
    </svg>
  );
}
