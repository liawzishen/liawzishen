"use client";

import { Link } from "@/components/ui/Link";
import { cn } from "@/lib/utils";
import { SideRail, type RailTab } from "@/components/layout/SideRail";
import { tabMatches, useHighlightedPath } from "@/components/layout/activeTab";

/** The raised centre button of a shell (the grower's AI Scan, the shopper's Scan QR). */
export type ShellFab = { href: string; label: string; icon: React.ReactNode };

/**
 * The tab chrome both sides of the product share: the floating glass pill
 * bar with a raised centre button on phones, and the side rail at ≥1024px.
 *
 * `AppShell` (growers) and `ConsumerShell` (shoppers) only describe WHICH
 * tabs and button they have; how a shell looks and behaves lives here once.
 * A new kind of shell is a new list of tabs, not a copy of this file.
 */
export function TabShell({
  tabs,
  fab,
  children,
}: {
  tabs: RailTab[];
  fab: ShellFab;
  children: React.ReactNode;
}) {
  // The tapped tab lights up at once, before its page has loaded.
  const currentPath = useHighlightedPath([...tabs, { href: fab.href, exact: false }]);

  const tabLink = (tab: RailTab) => (
    <Link
      key={tab.href}
      href={tab.href}
      prefetch={null} // always visible, tapped all the time → skeleton ready
      className={cn(
        "pressable flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-colors",
        tabMatches(currentPath, tab) ? "bg-brand/12 text-brand" : "text-secondary"
      )}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );

  // The centre button sits between the two halves of the tab list.
  const half = Math.ceil(tabs.length / 2);

  return (
    <>
      {/* Room for the floating bar + raised FAB; at lg the rail owns nav */}
      <div className="shell-breakout pb-[128px] lg:pb-8 lg:pl-[248px]">
        {children}
      </div>

      <SideRail tabs={tabs} fab={fab} currentPath={currentPath} />

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong lg:hidden"
      >
        {tabs.slice(0, half).map(tabLink)}

        {/* Centre FAB — the shell's signature action (06 §9) */}
        <Link
          href={fab.href}
          prefetch={null}
          aria-label={fab.label}
          className={cn(
            "pressable -mt-9 flex h-[50px] w-[50px] items-center justify-center rounded-full text-white bg-gradient-brand shadow-fab",
            currentPath.startsWith(fab.href) && "ring-2 ring-brand/40"
          )}
        >
          {fab.icon}
        </Link>

        {tabs.slice(half).map(tabLink)}
      </nav>
    </>
  );
}
