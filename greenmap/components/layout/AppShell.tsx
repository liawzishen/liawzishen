"use client";

import { useEffect } from "react";
import { shouldSaveData, whenIdle } from "@/lib/network";
import { preloadMapCanvas } from "@/components/farm/mapChunks";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { RailTab } from "@/components/layout/SideRail";
import { TabShell } from "@/components/layout/TabShell";

/*
 * 5-tab grower shell (06 §9): Home · Map · Scan(FAB) · Sales · Profile.
 * Liquid Glass restyle: floating glass pill bar detached from the screen
 * edges, SF-style line icons, soft green pill on the active tab, gradient
 * scan FAB. Rendered once by app/farms/[farmId]/(tabs)/layout.tsx so the
 * bar stays mounted across tab switches; pushed sub-pages use <TopNav />.
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
function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}
function SalesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.4 9.9h.01M17.6 14.1h.01" />
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
function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3.8 13.7 9l5.2 1.7-5.2 1.7L12 17.6l-1.7-5.2L5.1 10.7 10.3 9 12 3.8Z"
        fill="currentColor"
      />
      <circle cx="18.6" cy="17.4" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function AppShell({
  farmId,
  children,
}: {
  farmId: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const base = `/farms/${farmId}`;

  // The Map tab is the heart of the app. Fetch its canvas code while the
  // browser is idle, so the map appears with the tab instead of after a
  // "Loading map…" pause. Skipped when the farmer asked to save data.
  useEffect(() => {
    if (shouldSaveData()) return;
    return whenIdle(preloadMapCanvas, 3000);
  }, []);

  const tabs: RailTab[] = [
    { href: base, label: t.tabs.home, icon: <HomeIcon />, exact: true },
    { href: `${base}/field`, label: t.tabs.map, icon: <MapIcon />, exact: false },
    { href: `${base}/sales`, label: t.tabs.sales, icon: <SalesIcon />, exact: false },
    { href: `${base}/profile`, label: t.tabs.profile, icon: <ProfileIcon />, exact: false },
  ];

  return (
    <TabShell
      tabs={tabs}
      fab={{ href: `${base}/scan`, label: "AI Scan", icon: <SparkleIcon /> }}
    >
      {children}
    </TabShell>
  );
}
