import Link from "next/link";
import type { Farm } from "@/types/database";

/** A farm tile in the selector grid (06 §3). */
export function FarmCard({
  farm,
  plantCount,
  href,
}: {
  farm: Farm;
  plantCount: number;
  /** Where the card links to. Defaults to the farm's home dashboard. */
  href?: string;
}) {
  return (
    <Link
      href={href ?? `/farms/${farm.id}`}
      className="block overflow-hidden rounded-card bg-card shadow-card transition active:opacity-80"
    >
      {/* Background thumbnail */}
      <div className="relative h-28 w-full">
        {farm.background_url &&
        (farm.background_type === "upload" ||
          farm.background_type === "satellite") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={farm.background_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: "linear-gradient(135deg,#DFF5E1,#C9EAD0)",
              backgroundImage:
                "radial-gradient(rgba(52,199,89,0.35) 2px, transparent 2px)",
              backgroundSize: "20px 20px",
            }}
          />
        )}
      </div>

      <div className="p-4">
        <p className="text-[16px] font-semibold">{farm.name}</p>
        <p className="mt-0.5 text-[13px] capitalize text-secondary">
          {farm.crop_type} · {farm.location}
        </p>
        <p className="mt-1.5 text-[13px] text-brand-dark">
          {plantCount} {plantCount === 1 ? "plant" : "plants"}
        </p>
      </div>
    </Link>
  );
}
