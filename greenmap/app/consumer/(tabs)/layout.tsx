import { ConsumerShell } from "@/components/layout/ConsumerShell";

/**
 * Shared layout for the consumer tab screens (Home · Market · Orders ·
 * Profile). Rendering the ConsumerShell here keeps the tab bar mounted
 * across tab switches. Pushed sub-pages (market/[listingId], scan) live
 * outside this group and use their own <TopNav /> back header.
 */
export default function ConsumerTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConsumerShell>{children}</ConsumerShell>;
}
