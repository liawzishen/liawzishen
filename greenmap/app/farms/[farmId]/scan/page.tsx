import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ScanPickerPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  return (
    <AppShell farmId={farmId}>
      <main className="px-6 pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          AI
        </p>
        <h1 className="mt-1 text-[34px] font-bold leading-tight">AI Scan</h1>
        <EmptyState
          icon="✨"
          title="AI Scan — Phase 6"
          body="Pick a plant, upload a leaf photo and get a Gemini Vision diagnosis you review before saving. Built in Phase 6."
        />
      </main>
    </AppShell>
  );
}
