"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 * Keeping visited pages, safely.
 *
 * next.config.ts sets `staleTimes.dynamic`, so the browser keeps a visited
 * page for a short time and going back to a tab is instant (no server trip,
 * no skeleton). The price: a kept page can show OLD data after the user
 * changes something. So the rule for this app is:
 *
 *   Every action that changes data calls `refreshData()` — never a bare
 *   `router.refresh()`.
 *
 * `router.refresh()` reloads the current page and drops every kept page. But
 * Next discards a refresh that is still in flight when the user navigates
 * (navigation has priority) — then the kept pages would survive, stale.
 * <RefreshGuard> closes that gap:
 *
 *   - `refreshData()` raises a flag before it asks for the refresh.
 *   - The root layout is re-rendered ONLY by a refresh (normal navigation
 *     leaves it alone), and it hands a new `renderToken` to <RefreshGuard>
 *     each time. A new token therefore means "a refresh was applied" and the
 *     flag is lowered.
 *   - If the path changes while the flag is still up, the refresh was lost,
 *     so it is asked for again. The page shown from the kept copy corrects
 *     itself one round trip later.
 */

/** True from a data change until a refresh has really been applied. */
let refreshOwed = false;

/**
 * Use this one right before `router.push()` after a write: it only raises
 * the flag, and <RefreshGuard> runs the refresh when the navigation lands
 * (asking for it earlier would be discarded by that navigation).
 */
export function markDataChanged(): void {
  refreshOwed = true;
}

/**
 * Returns `refreshData()`: reload the current page's server data and drop
 * all kept pages. Call it after every successful write that stays on the page.
 */
export function useRefreshData(): () => void {
  const router = useRouter();
  return useCallback(() => {
    markDataChanged();
    router.refresh();
  }, [router]);
}

/** Mounted once in the root layout. Renders nothing. */
export function RefreshGuard({ renderToken }: { renderToken: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const seenToken = useRef(renderToken);
  const seenPath = useRef(pathname);

  // A new token = the root layout was rendered again = a refresh was applied.
  useEffect(() => {
    if (seenToken.current === renderToken) return;
    seenToken.current = renderToken;
    refreshOwed = false;
  }, [renderToken]);

  // A navigation happened while a refresh was still owed: ask again.
  useEffect(() => {
    if (seenPath.current === pathname) return;
    seenPath.current = pathname;
    if (refreshOwed) router.refresh();
  }, [pathname, router]);

  return null;
}
