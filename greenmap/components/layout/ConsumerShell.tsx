"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { SideRail, type RailTab } from "@/components/layout/SideRail";

/*
 * Consumer tab shell — the buyer-side mirror of the grower AppShell.
 * Tabs: Home · Market · Scan(FAB) · Profile. Floating glass pill bar, kept
 * mounted by app/consumer/(tabs)/layout.tsx so navigation swaps only content.
 * Routes are fixed under /consumer (no farmId — consumers don't own farms).
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.7V19a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18.5 19V9.7" />
      <path d="M9.6 20.3v-5.1a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v5.1" />
    </svg>
  );
}
function MarketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M5 8h14l-1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
function OrdersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M4.8 19.6c1.6-3.1 4.1-4.7 7.2-4.7s5.6 1.6 7.2 4.7" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h16" />
    </svg>
  );
}

export function ConsumerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs: RailTab[] = [
    { href: "/consumer", label: t.tabs.home, icon: <HomeIcon />, exact: true },
    { href: "/consumer/market", label: t.tabs.market, icon: <MarketIcon />, exact: false },
    { href: "/consumer/orders", label: t.tabs.orders, icon: <OrdersIcon />, exact: false },
    { href: "/consumer/profile", label: t.tabs.profile, icon: <ProfileIcon />, exact: false },
  ];

  const isActive = (tab: { href: string; exact: boolean }) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  const tabLink = (tab: (typeof tabs)[number]) => (
    <Link
      key={tab.href}
      href={tab.href}
      // The tint + colour swap is invisible to assistive tech (and to anyone
      // who can't separate green from brown), so the state has to be spoken.
      aria-current={isActive(tab) ? "page" : undefined}
      className={cn(
        "pressable flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-colors",
        // brand-dark, not brand: this 10px label sits on glass + a brand tint,
        // where plain --color-brand measures 4.46:1 — just under AA.
        isActive(tab) ? "bg-brand/12 text-brand-dark" : "text-secondary"
      )}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );

  const scanActive = pathname.startsWith("/consumer/scan");

  return (
    <>
      <div className="shell-breakout pb-[128px] lg:pb-8 lg:pl-[248px]">
        {children}
      </div>

      <SideRail
        tabs={tabs}
        fab={{ href: "/consumer/scan", label: t.tabs.scanQr, icon: <ScanIcon /> }}
      />

      <nav
        aria-label="Main"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex h-16 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 glass-strong lg:hidden"
      >
        {tabLink(tabs[0])}
        {tabLink(tabs[1])}

        {/* Centre Scan FAB — the signature consumer action */}
        <Link
          href="/consumer/scan"
          aria-label={t.tabs.scanQr}
          aria-current={scanActive ? "page" : undefined}
          className={cn(
            "pressable -mt-9 flex h-[50px] w-[50px] items-center justify-center rounded-full text-white bg-gradient-brand shadow-fab",
            scanActive && "ring-2 ring-brand/40"
          )}
        >
          <ScanIcon />
        </Link>

        {tabLink(tabs[2])}
        {tabLink(tabs[3])}
      </nav>
    </>
  );
}
