import Link from "next/link";
import { healthDisplay } from "@/lib/health/display";
import type { Plant } from "@/types/database";

/**
 * Desktop side-panel list of plants that need care — the list form of the
 * map's "Need Care" marker filter (same rule: active + not marked healthy,
 * or live score below 70). Each row links to the plant's detail page.
 */
export function NeedsCareList({
  plants,
  farmId,
}: {
  plants: Plant[];
  farmId: string;
}) {
  const MAX_ROWS = 8;
  const needsCare = plants
    .filter(
      (p) =>
        p.lifecycle_status === "active" &&
        (p.manual_status !== "healthy" ||
          (p.health_score !== null && p.health_score < 70))
    )
    .sort((a, b) => (a.health_score ?? 101) - (b.health_score ?? 101));

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold">Needs care</h3>
        {needsCare.length > 0 && (
          <span className="text-[11px] font-semibold text-warning">
            {needsCare.length} plant{needsCare.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {needsCare.length === 0 ? (
        <p className="mt-3 rounded-input bg-fill px-3 py-3 text-center text-[13px] text-secondary">
          All plants are doing well 🌱
        </p>
      ) : (
        <ul className="mt-2">
          {needsCare.slice(0, MAX_ROWS).map((p) => {
            const d = healthDisplay(p.health_score);
            return (
              <li key={p.id} className="hairline-t first:border-t-0">
                <Link
                  href={`/farms/${farmId}/plants/${p.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {p.name}
                    </span>
                    <span className="block truncate text-[11px] capitalize text-secondary">
                      {p.type}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[13px] font-bold"
                    style={{ color: d.color }}
                  >
                    {p.health_score !== null ? p.health_score : d.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {needsCare.length > MAX_ROWS && (
        <p className="mt-1 text-[11px] text-secondary">
          +{needsCare.length - MAX_ROWS} more — use the map&apos;s Need Care
          filter to see them all.
        </p>
      )}
    </section>
  );
}
