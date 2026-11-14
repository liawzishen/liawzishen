import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { HarvestConfirm } from "@/components/passport/HarvestConfirm";

export default async function HarvestPassportPage({
  params,
}: {
  params: Promise<{ farmId: string; plantId: string }>;
}) {
  const { farmId, plantId } = await params;
  const supabase = await createClient();

  // Both are keyed by the plant id, so they run in one round trip.
  const [{ data: plant }, { data: pass }] = await Promise.all([
    supabase
      .from("plants")
      .select("id, name, lifecycle_status")
      .eq("id", plantId)
      .single(),
    supabase
      .from("harvest_passports")
      .select("qr_token")
      .eq("plant_id", plantId)
      .maybeSingle(),
  ]);
  if (!plant) notFound();
  const p = plant as { id: string; name: string; lifecycle_status: string };

  // Already harvested → jump straight to its passport.
  if (p.lifecycle_status === "harvested" && pass?.qr_token) {
    redirect(`/passport/${pass.qr_token}`);
  }

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="Harvest" backHref={`/farms/${farmId}/plants/${plantId}`} />
      <HarvestConfirm plantId={plantId} plantName={p.name} />
    </main>
  );
}
