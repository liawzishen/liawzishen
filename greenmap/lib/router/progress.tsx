"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { inAppLinkTarget } from "./paths";

/*
 * Feedback while a tapped link is loading.
 *
 * Most links are not prefetched (see components/ui/Link.tsx), so between the
 * tap and the server's first answer nothing on the page would change. To
 * keep every tap feeling answered:
 *
 *   - `usePendingPath()` tells the tab bars which page was tapped, so the
 *     tab lights up at once.
 *   - A thin bar at the top of the screen appears only if the answer takes
 *     longer than a moment (the delay is in the CSS, see `.nav-progress`).
 *
 * Both end when the path changes — that is, when the next page (or its
 * loading skeleton) is on screen. The bar is decoration: if a navigation
 * never lands it removes itself.
 */

/** A navigation that takes longer than this is treated as lost. */
const GIVE_UP_MS = 10_000;

const PendingPathContext = createContext<string | null>(null);

/** The pathname a tapped link is loading right now, or null. */
export function usePendingPath(): string | null {
  return useContext(PendingPathContext);
}

/** Mounted once in the root layout, around the whole app. */
export function NavigationProgress({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // The page changed — whatever was loading has landed (or was replaced).
  // (Resetting state during render is React's pattern for "prop changed".)
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPendingPath(null);
  }

  useEffect(() => {
    // Capture phase: runs before any component handler, for every link in
    // the app, without each link needing its own code.
    const onClick = (event: MouseEvent) => {
      const target = inAppLinkTarget(event, window.location);
      if (target) setPendingPath(target);
    };
    const clear = () => setPendingPath(null);

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", clear); // back / forward
    window.addEventListener("pageshow", clear); // restored from the back cache
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", clear);
      window.removeEventListener("pageshow", clear);
    };
  }, []);

  useEffect(() => {
    if (!pendingPath) return;
    const id = window.setTimeout(() => setPendingPath(null), GIVE_UP_MS);
    return () => window.clearTimeout(id);
  }, [pendingPath]);

  return (
    <PendingPathContext.Provider value={pendingPath}>
      {pendingPath && <div className="nav-progress" aria-hidden />}
      {children}
    </PendingPathContext.Provider>
  );
}
