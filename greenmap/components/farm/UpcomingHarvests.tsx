import Link from "next/link";
import type { Plant } from "@/types/database";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - today.getTime()) / 86400000
  );
}

/**
 * Desktop dashboard card: active plants ordered by expected harvest date —
 * overdue/today first ("Ready"), then the coming weeks. About five rows are
 * visible; the list scrolls internally beyond that.
 */
export function UpcomingHarvests({
  plants,
  farmId,
}: {
  plants: Plant[];
  farmId: string;
}) {
  const upcoming = plants
    .filter((p) => p.lifecycle_status === "active" && p.expected_harvest_date)
    .sort((a, b) =>
      a.expected_harvest_date! < b.expected_harvest_date! ? -1 : 1
    );

  return (
    <section className="rounded-card p-4 glass">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold">Upcoming harvests</h3>
        {upcoming.length > 0 && (
          <span className="text-[11px] text-secondary">
            {upcoming.length} planned
          </span>
        )}
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-3 rounded-input bg-fill px-3 py-3 text-center text-[13px] text-secondary">
          No harvest dates set — add expected dates when planting.
        </p>
      ) : (
        <ul className="mt-2 max-h-[264px] overflow-y-auto pr-1 [scrollbar-width:thin]">
          {upcoming.map((p) => {
            const d = daysUntil(p.expected_harvest_date!);
            const ready = d <= 0;
            return (
              <li key={p.id} className="hairline-t first:border-t-0">
                <Link
                  href={`/farms/${farmId}/plants/${p.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                >
                  <span className="text-[16px] leading-none" aria-hidden>
                    🧺
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {p.name}
                    </span>
                    <span className="block truncate text-[11px] capitalize text-secondary">
                      {p.type} ·{" "}
                      {new Date(
                        `${p.expected_harvest_date}T00:00:00`
                      ).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      ready
                        ? "bg-brand/15 text-brand-dark"
                        : "bg-fill text-secondary"
                    }`}
                  >
                    {ready ? "Ready" : `${d}d`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
