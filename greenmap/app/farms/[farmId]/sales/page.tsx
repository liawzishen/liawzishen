import { AppShell } from "@/components/layout/AppShell";
import { SalesDashboard } from "@/components/sales/SalesDashboard";

/**
 * Sales tab — "My Sales" hub. Simulated marketplace preview (no real
 * persistence or payment); see SalesDashboard for the mock data + interactions.
 */
export default async function SalesPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  return (
    <AppShell farmId={farmId}>
      <SalesDashboard farmId={farmId} />
    </AppShell>
  );
}
