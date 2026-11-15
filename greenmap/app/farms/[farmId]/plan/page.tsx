import { redirect } from "next/navigation";
import { getPlanOverview } from "@/lib/account/queries";
import { TopNav } from "@/components/layout/TopNav";
import { PlanPageClient } from "@/components/billing/PlanPageClient";

/**
 * My Plan — current tier + usage, upgrade/downgrade, scan top-up, and the
 * simulated payment history. Pushed page reached from the Profile tab and
 * from the scan paywall.
 */
export default async function PlanPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const plan = await getPlanOverview();
  if (!plan) redirect("/auth");

  return (
    <main className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <TopNav title="My Plan" backHref={`/farms/${farmId}/profile`} />
      <PlanPageClient allowance={plan.allowance} payments={plan.payments} />
    </main>
  );
}
