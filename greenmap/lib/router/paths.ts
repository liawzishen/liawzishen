/**
 * Pure path helpers for navigation feedback (no React, no browser globals),
 * shared by the progress bar and the tab bars and covered by unit tests.
 */

export type TabTarget = { href: string; exact: boolean };

/** Does `path` belong to this tab? */
export function tabMatches(path: string, tab: TabTarget): boolean {
  return tab.exact ? path === tab.href : path.startsWith(tab.href);
}

/**
 * The pathname a click will navigate to inside this app, or null when the
 * click is not a plain same-site link tap (new tab, download, another site,
 * a button inside a link, the page we are already on…).
 */
export function inAppLinkTarget(
  event: Pick<
    MouseEvent,
    "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "target"
  >,
  current: { origin: string; pathname: string }
): string | null {
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const target = event.target as Element | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.hasAttribute("download")) return null;
  const opensElsewhere = anchor.getAttribute("target");
  if (opensElsewhere && opensElsewhere !== "_self") return null;

  // A control inside a link (e.g. a button on a card) handles its own tap.
  const control = target?.closest?.("button, input, select, textarea, label");
  if (control && anchor.contains(control)) return null;

  let url: URL;
  try {
    url = new URL(anchor.href, current.origin);
  } catch {
    return null;
  }
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname) return null; // same page (hash / query)
  return url.pathname;
}
