import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getFarmBundle } from "@/lib/farm/fetch";
import { healthDisplay, type HealthBand } from "@/lib/health/display";
import { createClient } from "@/lib/supabase/server";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";

const BADGE_TONE: Record<HealthBand, "brand" | "warning" | "critical" | "neutral"> = {
  healthy: "brand",
  attention: "warning",
  critical: "critical",
  new: "neutral",
};

/**
 * Scan tab (the centre FAB) — pick a plant, then run the existing per-plant
 * AI scan flow. Plants that need eyes first come first: never-scanned ("New")
 * plants, then lowest live health score upward.
 */
export default async function ScanPickerPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const [bundle, allowance] = await Promise.all([
    getFarmBundle(farmId),
    (async (): Promise<ScanAllowance | null> => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? getScanAllowance(supabase, user.id) : null;
    })(),
  ]);
  if (!bundle) notFound();

  const plants = bundle.plants
    .filter((p) => p.lifecycle_status === "active")
    .sort((a, b) => (a.health_score ?? -1) - (b.health_score ?? -1));

  return (
    <main className="px-5 pt-12 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        AI
      </p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">AI Scan</h1>
      <p className="mt-1 text-[14px] text-secondary">
        Pick a plant, snap a leaf, get an instant Gemini health check.
      </p>

      {allowance && (
        <Link
          href={`/farms/${farmId}/plan`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold glass transition active:bg-white/60"
        >
          🔬{" "}
          {allowance.remaining === null
            ? `${allowance.planName} — unlimited scans`
            : `${allowance.remaining} of ${(allowance.limit ?? 0) + allowance.bonus} scans left`}
          <span aria-hidden className="text-tertiary">
            ›
          </span>
        </Link>
      )}

      {plants.length === 0 ? (
        <EmptyState
          icon="✨"
          title="No plants to scan yet"
          body="Place your first plant on the farm map, then come back to scan it."
        >
          <Button href={`/farms/${farmId}/field`} full>
            Open Farm Map
          </Button>
        </EmptyState>
      ) : (
        <Card className="mt-5 p-0">
          {plants.map((p, i) => {
            const display = healthDisplay(p.health_score);
            return (
              <Link
                key={p.id}
                href={`/farms/${farmId}/plants/${p.id}/scan`}
                className={`flex items-center gap-3 p-4 active:bg-fill ${i > 0 ? "hairline-t" : ""}`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] bg-white text-[13px] font-bold"
                  style={{ borderColor: display.color }}
                >
                  {p.health_score ?? "+"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{p.name}</p>
                  <p className="truncate text-[13px] capitalize text-secondary">
                    {p.type}
                  </p>
                </div>
                <Badge tone={BADGE_TONE[display.band]}>{display.label}</Badge>
                <span aria-hidden className="text-[18px] text-tertiary">
                  ›
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </main>
  );
}
