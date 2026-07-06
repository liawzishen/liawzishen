import type { EventType, GrowthLog, Plant } from "@/types/database";

const META: Record<EventType, { icon: string; label: string }> = {
  planted: { icon: "🌱", label: "Planted" },
  water: { icon: "💧", label: "Watered" },
  fertilize: { icon: "🌿", label: "Fertilized" },
  ai_scan: { icon: "🔬", label: "AI Scan" },
  note: { icon: "📝", label: "Note" },
  harvested: { icon: "🧺", label: "Harvested" },
};

function relative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Desktop dashboard card: the farm's latest care events across all plants
 * (water, fertilize, scans, harvests…). About five rows are visible; the
 * list scrolls internally beyond that instead of growing the card.
 */
export function RecentActivityCard({
  logs,
  plants,
}: {
  logs: GrowthLog[];
  plants: Plant[];
}) {
  const nameOf = new Map(plants.map((p) => [p.id, p.name]));

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold">Recent activity</h3>
        <span className="text-[11px] text-secondary">all plants</span>
      </div>

      {logs.length === 0 ? (
        <p className="mt-3 rounded-input bg-fill px-3 py-3 text-center text-[13px] text-secondary">
          No activity yet — log watering or run a scan to see it here.
        </p>
      ) : (
        <ul className="mt-2 max-h-[264px] overflow-y-auto pr-1 [scrollbar-width:thin]">
          {logs.map((log) => {
            const meta = META[log.event_type];
            return (
              <li
                key={log.id}
                className="hairline-t flex items-center gap-3 py-2.5 first:border-t-0"
              >
                <span className="text-[16px] leading-none" aria-hidden>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {meta.label} · {nameOf.get(log.plant_id) ?? "Plant"}
                  </span>
                  {log.note && (
                    <span className="block truncate text-[11px] text-secondary">
                      {log.note}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-secondary">
                  {relative(log.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
