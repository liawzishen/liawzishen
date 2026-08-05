import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/Button";
import { ScanUploader } from "@/components/ai/ScanUploader";
import { getScanAllowance } from "@/lib/billing/usage";
import { formatRM, TOPUP_PRICE_RM } from "@/lib/billing/plans";

export default async function PlantScanPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: plant }, allowance] = await Promise.all([
    supabase.from("plants").select("name, type").eq("id", plantId).single(),
    user ? getScanAllowance(supabase, user.id) : Promise.resolve(null),
  ]);
  if (!plant) notFound();
  const p = plant as { name: string; type: string };

  const blocked = allowance !== null && allowance.remaining === 0;
  const resetLabel = allowance
    ? new Date(allowance.resetsOn).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
      })
    : "";

  return (
    <main
      id="main-content"
      className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]"
    >
      <TopNav title="AI Scan" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <div className="px-6 pt-2">
        {/* TopNav's "AI Scan" is the page <h1>; the plant is its subject. */}
        <h2 className="text-[24px] font-bold leading-tight">{p.name}</h2>
        <p className="mt-0.5 text-[14px] text-secondary">
          Snap a leaf for an instant Gemini health check.
        </p>
        <div className="mt-4">
          {blocked && allowance ? (
            <div className="rounded-card p-6 text-center glass">
              <div
                aria-hidden
                className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warning/15 text-[26px]"
              >
                🔬
              </div>
              <h3 className="mt-3 text-[18px] font-bold">
                You&apos;ve used all {(allowance.limit ?? 0) + allowance.bonus}{" "}
                scans this month
              </h3>
              <p className="mt-1 text-[14px] leading-relaxed text-secondary">
                Upgrade your plan or top up to keep scanning. Your{" "}
                {allowance.planName} scans reset on {resetLabel}.
              </p>
              <div className="mt-5 space-y-3">
                <Button href={`/farms/${farmId}/plan`} full>
                  Upgrade plan
                </Button>
                <Button href={`/farms/${farmId}/plan`} variant="fill" full>
                  Top up · {formatRM(TOPUP_PRICE_RM)}/scan
                </Button>
              </div>
            </div>
          ) : (
            <ScanUploader
              plantId={plantId}
              farmId={farmId}
              cropType={p.type}
              scansLeft={allowance ? allowance.remaining : undefined}
            />
          )}
        </div>
      </div>
    </main>
  );
}
