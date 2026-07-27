"use client";

import { useEffect, useRef, useState } from "react";
import type { Farm, FarmPanorama } from "@/types/database";
import { reprojectNadir } from "./aerial";

const DISC = 400; // per-disc output resolution
const SRC_W = 1024; // downscaled source width
const SRC_H = 512; // downscaled source height
const MOSAIC_MAX = 1200; // composite long-side cap (px)
const DISC_RADIUS_FRAC = 0.5; // disc radius as a fraction of min(mosaic side)

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("aerial: image load failed"));
    img.src = url;
  });
}

/**
 * Average opaque colour of a reprojected disc (alpha-weighted, transparent rim
 * ignored) via a 1×1 downsample. Used to tint the ground fill so the mosaic
 * covers the whole map with a matching tone instead of a hard disc edge.
 */
function discAverageColor(
  disc: HTMLCanvasElement
): [number, number, number] | null {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.drawImage(disc, 0, 0, 1, 1);
  const d = cx.getImageData(0, 0, 1, 1).data;
  if (d[3] === 0) return null; // fully transparent → no colour to sample
  return [d[0], d[1], d[2]];
}

/**
 * Build a top-down aerial mosaic from the farm's 360° captures and return it
 * as a canvas to use as the 2D map background. Lazy (runs after paint) and
 * memoized on the capture set (ids + headings + canvas size). Returns null — so
 * the caller keeps its normal background — when there are no captures or on any
 * failure. Live, browser-only, no storage.
 *
 * `enabled` pauses generation without discarding the finished canvas, so
 * flipping 2D → 3D → 2D reuses it instead of re-decoding and re-reprojecting
 * every panorama (which flashed the fallback background and burned main-thread
 * time on every toggle). Work still restarts whenever `key` actually changes.
 */
export function useAerialMosaic(
  farm: Farm,
  panoramas: FarmPanorama[],
  enabled = true
) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const key = `${farm.canvas_width}x${farm.canvas_height}|${panoramas
    .map((p) => `${p.id}:${p.heading_deg}`)
    .join("|")}`;
  // Which key the canvas we're holding was built for, and which one is in
  // flight — together these make re-enabling a no-op when nothing changed.
  const builtKey = useRef<string | null>(null);
  const runningKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setGenerating(false); // nothing is in flight while paused
      return; // keep `canvas` — that's the whole point
    }
    if (panoramas.length === 0) {
      builtKey.current = key;
      setCanvas(null);
      setGenerating(false);
      return;
    }
    // Already have (or are already building) exactly this mosaic.
    if (builtKey.current === key || runningKey.current === key) return;
    let disposed = false;

    const run = async () => {
      if (disposed || runningKey.current === key) return;
      runningKey.current = key;
      setGenerating(true);
      try {
        const w = farm.canvas_width;
        const h = farm.canvas_height;
        const long = Math.max(w, h);
        const s = long > MOSAIC_MAX ? MOSAIC_MAX / long : 1;
        const mw = Math.max(1, Math.round(w * s));
        const mh = Math.max(1, Math.round(h * s));
        const out = document.createElement("canvas");
        out.width = mw;
        out.height = mh;
        const ctx = out.getContext("2d")!;
        const radius = DISC_RADIUS_FRAC * Math.min(mw, mh);

        const ordered = [...panoramas].sort((a, b) =>
          a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
        );

        // Reproject every capture first: keep each textured disc plus a running
        // average of their ground colour, so we can tint the whole canvas
        // underneath (nothing shows through the gaps between captures) and then
        // lay the discs on top. Per-photo failures are skipped, not fatal.
        const discs: { disc: HTMLCanvasElement; x: number; y: number }[] = [];
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let nCol = 0;
        for (const p of ordered) {
          if (disposed) return;
          try {
            const img = await loadImage(p.image_url);
            const disc = reprojectNadir(img, SRC_W, SRC_H, p.heading_deg, DISC);
            const color = discAverageColor(disc);
            if (color) {
              rSum += color[0];
              gSum += color[1];
              bSum += color[2];
              nCol++;
            }
            discs.push({ disc, x: p.position_x * mw, y: p.position_y * mh });
          } catch {
            continue; // skip a photo that fails to load, reproject, or draw
          }
        }
        if (disposed) return;
        if (discs.length === 0) {
          builtKey.current = key;
          setCanvas(null);
          return;
        }

        // Opaque ground fill in the blended average tone → the aerial now
        // fills the entire map instead of floating as discs on the card.
        if (nCol > 0) {
          const r = Math.round(rSum / nCol);
          const g = Math.round(gSum / nCol);
          const b = Math.round(bSum / nCol);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(0, 0, mw, mh);
        }
        // Textured captures on top; their feathered rims melt into the fill.
        for (const d of discs) {
          ctx.drawImage(
            d.disc,
            d.x - radius,
            d.y - radius,
            radius * 2,
            radius * 2
          );
        }
        builtKey.current = key;
        setCanvas(out);
      } catch {
        if (!disposed) {
          builtKey.current = null; // let a later attempt retry this key
          setCanvas(null);
        }
      } finally {
        // Only release the marker if it's still ours: a disposed run has
        // already had it cleared by the cleanup below, and clearing it again
        // could release a replacement run's claim (StrictMode double-invoke).
        if (!disposed && runningKey.current === key) runningKey.current = null;
        if (!disposed) setGenerating(false);
      }
    };

    // Run after paint so the normal background shows first, then swaps in.
    let handle: number;
    const ric = (
      globalThis as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (ric) handle = ric(() => void run());
    else handle = window.setTimeout(() => void run(), 0);

    return () => {
      disposed = true;
      // An aborted run left nothing behind — clear the marker so remounting
      // (StrictMode, a mode flip) can start it again.
      if (runningKey.current === key) runningKey.current = null;
      const cic = (
        globalThis as unknown as {
          cancelIdleCallback?: (h: number) => void;
        }
      ).cancelIdleCallback;
      if (ric && cic) cic(handle);
      else window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return { canvas, generating };
}
