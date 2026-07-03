import { AppShell } from "@/components/layout/AppShell";

/**
 * Shared layout for the five tab-root screens (Home · Map · Scan · Sales ·
 * Profile). Rendering the AppShell here — instead of inside every page —
 * keeps the tab bar mounted across tab switches, so navigation swaps only
 * the content area (with (tabs)/loading.tsx as its instant skeleton).
 * Pushed sub-pages (plants/**, sales/market, sales/new) live outside this
 * group and keep their <TopNav /> back-button header.
 */
export default async function TabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  return <AppShell farmId={farmId}>{children}</AppShell>;
}
