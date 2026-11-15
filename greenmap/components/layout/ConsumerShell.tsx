"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { RailTab } from "@/components/layout/SideRail";
import { TabShell } from "@/components/layout/TabShell";

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
  const { t } = useI18n();

  const tabs: RailTab[] = [
    { href: "/consumer", label: t.tabs.home, icon: <HomeIcon />, exact: true },
    { href: "/consumer/market", label: t.tabs.market, icon: <MarketIcon />, exact: false },
    { href: "/consumer/orders", label: t.tabs.orders, icon: <OrdersIcon />, exact: false },
    { href: "/consumer/profile", label: t.tabs.profile, icon: <ProfileIcon />, exact: false },
  ];

  return (
    <TabShell
      tabs={tabs}
      fab={{ href: "/consumer/scan", label: "Scan QR", icon: <ScanIcon /> }}
    >
      {children}
    </TabShell>
  );
}
