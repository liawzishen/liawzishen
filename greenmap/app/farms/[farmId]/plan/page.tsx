import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { getScanAllowance } from "@/lib/billing/usage";
import {
  PlanPageClient,
  type PaymentRow,
} from "@/components/billing/PlanPageClient";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [allowance, paymentsRes] = await Promise.all([
    getScanAllowance(supabase, user.id),
    supabase
      .from("payments")
      .select("id, kind, amount_rm, method, created_at, meta")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const payments = (paymentsRes.data ?? []) as PaymentRow[];

  return (
    <main className="pb-12">
      <TopNav title="My Plan" backHref={`/farms/${farmId}/profile`} />
      <PlanPageClient farmId={farmId} allowance={allowance} payments={payments} />
    </main>
  );
}
