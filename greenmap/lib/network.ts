/**
 * Small browser helpers for "load it before it is needed" — used to fetch the
 * map and 3D code ahead of the tap, without getting in the way of the page
 * and without spending a farmer's mobile data when they asked to save it.
 */

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

/** True when the visitor asked the browser to save data, or is on 2G. */
export function shouldSaveData(
  nav: { connection?: NetworkInfo } | undefined = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { connection?: NetworkInfo })
): boolean {
  const connection = nav?.connection;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

/**
 * Run `task` once the browser is idle (or after `timeoutMs` at the latest).
 * Returns a function that cancels it — call it from a `useEffect` cleanup.
 * Safari has no `requestIdleCallback`, so it falls back to a short timer.
 */
export function whenIdle(task: () => void, timeoutMs = 2000): () => void {
  if (typeof window === "undefined") return () => {};

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, Math.min(timeoutMs, 600));
  return () => window.clearTimeout(id);
}
