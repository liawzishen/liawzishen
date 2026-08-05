import { healthDisplay } from "@/lib/health/display";

/**
 * 7-day health trend — a dependency-free inline SVG line+area chart on a fixed
 * 0-100 scale, with faint band-threshold guides at 70 and 40. Server-renderable
 * (no client JS). Falls back to a friendly empty state with < 2 points.
 */
export function HealthTrendChart({
  points,
}: {
  points: { score: number; created_at: string }[];
}) {
  if (points.length < 2) {
    return (
      <div className="mt-3 flex h-28 items-center justify-center rounded-input bg-fill px-4 text-center text-[13px] text-secondary">
        Not enough history yet — log care or run a scan to start the trend.
      </div>
    );
  }

  const W = 320;
  const H = 104;
  const pad = 10;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const y = (s: number) => pad + (1 - s / 100) * (H - 2 * pad);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(H - pad).toFixed(1)} L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`;

  const last = points[points.length - 1].score;
  const first = points[0].score;
  const color = healthDisplay(last).color;

  /*
   * role="img" was already here, but the label only named the chart — a
   * screen-reader user was told "7-day health trend" and nothing about the
   * trend itself. The alternative text for a graph has to carry the
   * reading, so it states where the score started, where it is now, which
   * way it moved, and which health band that lands in.
   */
  const delta = last - first;
  const direction =
    delta > 0 ? `up ${delta}` : delta < 0 ? `down ${Math.abs(delta)}` : "unchanged";
  const summary =
    `7-day health trend: ${first} to ${last} out of 100, ${direction}. ` +
    `Currently ${healthDisplay(last).label}.`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={summary}>
      {[70, 40].map((g) => (
        <line
          key={g}
          x1={pad}
          x2={W - pad}
          y1={y(g)}
          y2={y(g)}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeDasharray="3 4"
          className="text-secondary"
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
        <circle key={i} cx={x(i)} cy={y(p.score)} r={2.6} fill={color} />
      ))}
    </svg>
  );
}
