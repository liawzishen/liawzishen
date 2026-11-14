/**
 * Lazy loaders for the two heavy map engines: the 2D canvas (Konva, ~60 kB
 * gzipped) and the 3D photo tour (three.js, ~270 kB gzipped). Neither is in
 * the first-load bundle. They live here, apart from the components, so other
 * screens can warm them up without importing the engines themselves.
 */

export const loadFarmMapCanvas = () =>
  import("./FarmMapCanvas").then((m) => m.FarmMapCanvas);

export const loadFarmTour = () =>
  import("./tour/FarmTour").then((m) => m.FarmTour);

/**
 * Fetch an engine's code ahead of time. The browser caches it, so the later
 * real load is instant. Failures are ignored on purpose (e.g. offline) — the
 * real load shows its own state.
 */
export function preloadMapCanvas(): void {
  void loadFarmMapCanvas().catch(() => {});
}

export function preloadFarmTour(): void {
  void loadFarmTour().catch(() => {});
}
