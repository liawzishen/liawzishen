"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
}: {
  tabs: RailTab[];
  fab: { href: string; label: string; icon: React.ReactNode };
}) {
  const pathname = usePathname();
  const isActive = (tab: RailTab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  const fabActive = pathname.startsWith(fab.href);

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
            // Tint + colour alone don't reach assistive tech; say "current page".
            aria-current={isActive(tab) ? "page" : undefined}
            className={cn(
              "pressable flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              // brand-dark, not brand: on glass + a brand tint, plain
              // --color-brand measures 4.46:1 — just under the 4.5:1 AA floor.
              isActive(tab) ? "bg-brand/12 text-brand-dark" : "text-secondary"
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </div>
      <Link
        href={fab.href}
        aria-current={fabActive ? "page" : undefined}
        className={cn(
          "pressable pressable-glow mt-auto flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white bg-gradient-brand shadow-fab",
          fabActive && "ring-2 ring-brand/40"
        )}
      >
        {fab.icon}
        {fab.label}
      </Link>
    </nav>
  );
}
