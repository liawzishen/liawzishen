/** Earned-only trust badge row for the Harvest Passport. */
export function TrustBadges({
  pesticideFree,
  organic,
  aiVerified,
  verifiedGrower,
}: {
  pesticideFree: boolean;
  organic: boolean;
  aiVerified: boolean;
  verifiedGrower: boolean;
}) {
  const badges: { icon: string; label: string }[] = [];
  if (pesticideFree) badges.push({ icon: "🛡️", label: "Pesticide-Free" });
  if (organic) badges.push({ icon: "🌿", label: "Organic" });
  if (aiVerified) badges.push({ icon: "🔬", label: "AI-Verified" });
  if (verifiedGrower) badges.push({ icon: "✅", label: "Verified Grower" });

  if (badges.length === 0) {
    return <p className="text-[13px] text-secondary">No badges earned yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand-dark"
        >
          <span aria-hidden>{b.icon}</span> {b.label}
        </span>
      ))}
    </div>
  );
}
