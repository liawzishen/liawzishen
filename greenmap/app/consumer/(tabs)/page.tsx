import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { LISTINGS } from "@/components/sales/demo-listings";
import { CONSUMER } from "@/components/consumer/demo-consumer";
import { rankListings } from "@/lib/marketplace/rank";

/**
 * Consumer home / dashboard (Phase-3 preview). "Know your food's story":
 * GreenPoints, a scan CTA, the top-ranked fresh produce near the shopper
 * (reusing the marketplace ranking engine), and their trust impact stats.
 */
export default async function ConsumerHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = (user?.user_metadata?.name as string | undefined) ?? "there";

  // Top 3 ranked listings as a "Fresh near you" teaser (ranker is pure).
  const now = Date.now();
  const rankable = LISTINGS.map((l) => ({
    ...l,
    harvestedAt: new Date(now - l.harvestedHoursAgo * 3_600_000).toISOString(),
  }));
  const featured = rankListings(rankable, { now: new Date(now) }).slice(0, 3);

  const impact = [
    { label: "Harvests verified", value: CONSUMER.impact.harvestsVerified, icon: "✓" },
    { label: "Farmers supported", value: CONSUMER.impact.farmersSupported, icon: "🧑‍🌾" },
    { label: "kg bought", value: CONSUMER.impact.kgBought, icon: "🧺" },
  ];

  return (
    <main className="px-5 pb-8 pt-12">
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          GreenMap
        </p>
        <Badge tone="warning">PREVIEW</Badge>
      </div>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">Hi, {name} 👋</h1>
      <p className="mt-1 text-[15px] text-secondary">Know your food&apos;s story.</p>

      {/* GreenPoints card */}
      <div className="mt-5 overflow-hidden rounded-card bg-gradient-brand p-4 text-white shadow-fab">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide opacity-90">
              GreenPoints · {CONSUMER.tier}
            </p>
            <p className="mt-1 text-[30px] font-bold leading-none">
              🌱 {CONSUMER.greenPoints}
            </p>
          </div>
          <Link
            href="/consumer/profile"
            className="rounded-full bg-white/20 px-3 py-1.5 text-[12px] font-semibold backdrop-blur active:opacity-80"
          >
            Rewards ›
          </Link>
        </div>
        <p className="mt-2 text-[12px] leading-snug opacity-90">
          Earn points on every verified purchase, review and QR scan — redeem
          for discount vouchers.
        </p>
      </div>

      {/* Scan CTA */}
      <Link
        href="/consumer/scan"
        className="mt-4 flex items-center gap-3 rounded-card p-4 glass active:opacity-90"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/12 text-[22px]">
          📷
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Scan a Harvest Passport</span>
          <span className="block text-[13px] text-secondary">
            Point your camera at a QR code to see the growing journey.
          </span>
        </span>
        <span className="shrink-0 text-tertiary">›</span>
      </Link>

      {/* Fresh near you — top ranked listings */}
      <div className="mb-2 mt-7 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Fresh Near You
        </h2>
        <Link href="/consumer/market" className="text-[13px] font-semibold text-brand">
          See all
        </Link>
      </div>
      <div className="space-y-3">
        {featured.map(({ listing: l, promoted }) => (
          <Link
            key={l.id}
            href={`/consumer/listing/${l.id}`}
            className="flex items-center gap-3 rounded-card p-3 glass active:opacity-90"
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-input text-[26px]"
              style={{ background: l.gradient }}
            >
              {l.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold">{l.name}</p>
                {promoted && (
                  <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                    ⚡
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-secondary">
                {l.farm} · {l.freshness} · {l.distanceKm} km
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-bold text-brand">RM {l.price}</p>
              <p className="text-[11px] text-secondary">/{l.unit}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Your impact */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Your Impact
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {impact.map((s) => (
          <div key={s.label} className="rounded-card p-3 text-center glass">
            <p className="text-[20px] leading-none">{s.icon}</p>
            <p className="mt-1.5 text-[20px] font-bold leading-none text-brand">
              {s.value}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-secondary">{s.label}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
