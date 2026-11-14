"use client";

import { usePathname } from "next/navigation";
import { usePendingPath } from "@/lib/router/progress";
import { tabMatches, type TabTarget } from "@/lib/router/paths";

export { tabMatches, type TabTarget };

/**
 * The path the tab bars should highlight. Normally the current page — but
 * when one of the shell's own tabs was just tapped it is that tab, so it
 * lights up at once instead of after its page has loaded.
 */
export function useHighlightedPath(tabs: TabTarget[]): string {
  const pathname = usePathname();
  const pendingPath = usePendingPath();
  return pendingPath && tabs.some((tab) => tabMatches(pendingPath, tab))
    ? pendingPath
    : pathname;
}
