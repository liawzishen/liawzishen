"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * 5-tab grower shell (06 §9): Home · Map · Scan(FAB) · Sales · Profile.
 * Frosted-bar values match the prototype exactly:
 * rgba(255,255,255,0.8) · blur ~25px · 0.5px top hairline · 88px tall.
 * Pushed sub-pages do NOT render this shell — they use <TopNav /> instead.
 */
export function AppShell({
  farmId,
  children,
}: {
  farmId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/farms/${farmId}`;

  const tabs = [
    { href: base, label: "Home", icon: "🏠", exact: true },
    { href: `${base}/map`, label: "Map", icon: "🗺️", exact: false },
    { href: `${base}/sales`, label: "Sales", icon: "💰", exact: false },
    { href: `${base}/profile`, label: "Profile", icon: "👤", exact: false },
  ];

  const isActive = (tab: { href: string; exact: boolean }) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  const tabLink = (tab: (typeof tabs)[number]) => (
    <Link
      key={tab.href}
      href={tab.href}
      className={cn(
        "flex min-w-[56px] flex-col items-center gap-1 pt-0.5 text-[10px] font-medium",
        isActive(tab) ? "text-brand" : "text-secondary"
      )}
    >
      <span aria-hidden className="text-[22px] leading-none">
        {tab.icon}
      </span>
      {tab.label}
    </Link>
  );

  return (
    <>
      {/* Room for the 88px bar + raised FAB */}
      <div className="pb-[104px]">{children}</div>

      <nav
        aria-label="Main"
        className="fixed bottom-0 left-1/2 z-30 flex h-[88px] w-full max-w-[430px] -translate-x-1/2 items-start justify-around border-t-[0.5px] border-black/10 bg-white/80 px-4 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
      >
        {tabLink(tabs[0])}
        {tabLink(tabs[1])}

        {/* Centre Scan FAB — the signature action (06 §9) */}
        <Link
          href={`${base}/scan`}
          aria-label="AI Scan"
          className={cn(
            "-mt-4 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-brand text-[20px] text-white shadow-fab",
            pathname.startsWith(`${base}/scan`) && "ring-2 ring-brand/30"
          )}
        >
          ✨
        </Link>

        {tabLink(tabs[2])}
        {tabLink(tabs[3])}
      </nav>
    </>
  );
}
