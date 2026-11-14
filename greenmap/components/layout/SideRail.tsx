"use client";

import { Link } from "@/components/ui/Link";
import { cn } from "@/lib/utils";
import { tabMatches } from "@/components/layout/activeTab";

export type RailTab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact: boolean;
};

/**
 * Desktop (≥1024px) navigation rail — the wide-screen counterpart of the
 * floating bottom pill (which hides itself at lg). Shared by AppShell and
 * ConsumerShell so both sides of the product get the same desktop chrome.
 * Fixed to the viewport's left edge in the same floating-glass language as
 * the pill; content shifts right via the shells' lg:pl-[248px] wrapper.
 */
export function SideRail({
  tabs,
  fab,
  currentPath,
}: {
  tabs: RailTab[];
  fab: { href: string; label: string; icon: React.ReactNode };
  /** The path to highlight (see useHighlightedPath). */
  currentPath: string;
}) {
  const isActive = (tab: RailTab) => tabMatches(currentPath, tab);

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-4 left-4 top-4 z-30 hidden w-[216px] flex-col rounded-[26px] p-4 glass-strong lg:flex"
    >
      <p className="px-2 pb-4 pt-1 font-rustic text-[17px] font-bold text-[#5c3a21]">
        🌿 GreenMap
      </p>
      <div className="flex flex-col gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={null}
            className={cn(
              "pressable flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              isActive(tab) ? "bg-brand/12 text-brand" : "text-secondary"
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </div>
      <Link
        href={fab.href}
        prefetch={null}
        className={cn(
          "pressable pressable-glow mt-auto flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white bg-gradient-brand shadow-fab",
          currentPath.startsWith(fab.href) && "ring-2 ring-brand/40"
        )}
      >
        {fab.icon}
        {fab.label}
      </Link>
    </nav>
  );
}
