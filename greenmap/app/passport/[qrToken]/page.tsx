import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { HarvestPassportCard } from "@/components/passport/HarvestPassportCard";
import { QrBlock } from "@/components/passport/QrBlock";
import type { EventType, Farm, GrowthLog, HarvestPassport, Plant } from "@/types/database";

const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  planted: { icon: "🌱", label: "Planted" },
  water: { icon: "💧", label: "Watered" },
  fertilize: { icon: "🌿", label: "Fertilized" },
  ai_scan: { icon: "🔬", label: "AI Scan" },
  note: { icon: "📝", label: "Note" },
  harvested: { icon: "🧺", label: "Harvested" },
};

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NotFoundView() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="text-[44px]" aria-hidden>🔍</div>
      <h1 className="mt-2 text-[20px] font-bold">Passport not found</h1>
      <p className="mt-1.5 text-[15px] text-secondary">
        This QR code doesn&apos;t match any harvest passport — it may be mistyped.
      </p>
      <p className="mt-auto pt-10 text-[12px] text-secondary">Powered by GreenMap</p>
    </main>
  );
}

export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const admin = createAdminClient();

  // Is a logged-in grower viewing this (e.g. straight after harvesting)? If so,
  // give them a way back into the app; consumers get an "Open GreenMap" link.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: passportRow } = await admin
    .from("harvest_passports")
    .select("*")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (!passportRow) return <NotFoundView />;
  const passport = passportRow as HarvestPassport;

  const [{ data: plantRow }, { data: farmRow }] = await Promise.all([
    admin.from("plants").select("*").eq("id", passport.plant_id).maybeSingle(),
    admin.from("farms").select("*").eq("id", passport.farm_id).maybeSingle(),
  ]);
  const plant = plantRow as Plant | null;
  const farm = farmRow as Farm | null;
  if (!plant || !farm) return <NotFoundView />;

  const { data: grower } = await admin
    .from("profiles")
    .select("name, is_verified")
    .eq("id", farm.user_id)
    .maybeSingle();
  const g = grower as { name: string; is_verified: boolean } | null;

  const { data: logs } = await admin
    .from("growth_logs")
    .select("*")
    .eq("plant_id", plant.id)
    .order("created_at", { ascending: true });
  const story = (logs ?? []) as GrowthLog[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = `${appUrl}/passport/${qrToken}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(
    `See how ${plant.name} (${plant.type}) was grown on GreenMap: ${url}`
  )}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pb-12 pt-10">
      <header className="relative flex h-7 items-center justify-center">
        {user ? (
          <Link
            href={`/farms/${farm.id}`}
            className="absolute left-0 inline-flex items-center gap-0.5 text-[14px] font-semibold text-brand active:opacity-80"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>
        ) : (
          <Link
            href="/"
            className="absolute right-0 text-[13px] font-semibold text-brand active:opacity-80"
          >
            Open GreenMap ›
          </Link>
        )}
        <p className="text-[17px] font-bold">🌿 GreenMap</p>
      </header>

      <div className="mt-6">
        <HarvestPassportCard
          plantName={plant.name}
          type={plant.type}
          farmName={farm.name}
          location={farm.location}
          growerName={g?.name ?? "Grower"}
          verifiedGrower={g?.is_verified ?? false}
          harvestDate={fmtDate(passport.harvest_date)}
          growDays={passport.grow_days}
          avgHealth={passport.avg_health}
          scanCount={passport.ai_scan_count}
          pesticideFree={passport.pesticide_free}
          organic={passport.organic}
          aiVerified={passport.ai_verified}
        />
      </div>

      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Growing Story
      </h2>
      <div className="rounded-card bg-card p-4 shadow-card">
        {story.length === 0 ? (
          <p className="text-center text-[14px] text-secondary">
            No recorded events.
          </p>
        ) : (
          <ol>
            {story.map((log, i) => {
              const m = EVENT_META[log.event_type] ?? {
                icon: "•",
                label: log.event_type,
              };
              const last = i === story.length - 1;
              return (
                <li key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-[14px]">
                      {m.icon}
                    </span>
                    {!last && <span className="w-px flex-1 bg-tertiary" />}
                  </div>
                  <div className={last ? "pb-1" : "pb-4"}>
                    <p className="text-[14px] font-semibold">{m.label}</p>
                    {log.note && (
                      <p className="text-[13px] text-secondary">{log.note}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-tertiary">
                      {fmtDate(log.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-7">
        <QrBlock url={url} />
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block w-full rounded-btn bg-brand py-3 text-center text-[15px] font-semibold text-white"
      >
        Share on WhatsApp
      </a>

      <p className="mt-auto pt-10 text-center text-[12px] text-secondary">
        Powered by GreenMap · Codex Hackathon KL 2026
      </p>
    </main>
  );
}
