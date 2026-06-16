import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SalesPreviewPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  return (
    <AppShell farmId={farmId}>
      <main className="px-6 pt-14">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
            Selling
          </p>
          <Badge tone="warning">PREVIEW</Badge>
        </div>
        <h1 className="mt-1 text-[34px] font-bold leading-tight">My Sales</h1>
        <EmptyState
          icon="💰"
          title="Selling is a Phase 3 concept"
          body="Marketplace, listings and orders stay preview-only for the hackathon. A static mockup of this screen may be added in Phase 8."
        />
      </main>
    </AppShell>
  );
}
