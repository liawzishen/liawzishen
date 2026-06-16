import { TrustBadges } from "./TrustBadges";

/** Certificate-style Harvest Passport card (06 §11). Presentational. */
export function HarvestPassportCard({
  plantName,
  type,
  farmName,
  location,
  growerName,
  verifiedGrower,
  harvestDate,
  growDays,
  avgHealth,
  scanCount,
  pesticideFree,
  organic,
  aiVerified,
}: {
  plantName: string;
  type: string;
  farmName: string;
  location: string;
  growerName: string;
  verifiedGrower: boolean;
  harvestDate: string;
  growDays: number;
  avgHealth: number;
  scanCount: number;
  pesticideFree: boolean;
  organic: boolean;
  aiVerified: boolean;
}) {
  const stats = [
    { l: "Grow Days", v: String(growDays) },
    { l: "Avg Health", v: `${avgHealth}%` },
    { l: "AI Scans", v: String(scanCount) },
  ];
  return (
    <div className="rounded-card bg-card p-6 shadow-card ring-1 ring-slate-100">
      <div className="text-center">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          Harvest Passport
        </p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">{plantName}</h1>
        <p className="mt-0.5 text-[14px] capitalize text-secondary">
          {type} · {farmName} · {location}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[14px]">
        <span className="text-secondary">Grown by</span>
        <span className="font-semibold">{growerName}</span>
        {verifiedGrower && <span title="Verified Grower">✅</span>}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        {stats.map((s) => (
          <div key={s.l} className="rounded-input bg-fill p-3">
            <p className="text-[20px] font-bold text-brand-dark">{s.v}</p>
            <p className="mt-0.5 text-[11px] text-secondary">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-secondary">
          Trust Badges
        </p>
        <TrustBadges
          pesticideFree={pesticideFree}
          organic={organic}
          aiVerified={aiVerified}
          verifiedGrower={verifiedGrower}
        />
      </div>

      <p className="mt-5 text-center text-[12px] text-secondary">
        Harvested {harvestDate}
      </p>
    </div>
  );
}
