"use client";

import { useEffect, useRef, useState } from "react";
import type { Farm, FarmPanorama } from "@/types/database";
import { reprojectNadir } from "./aerial";

const DISC = 400; // per-disc output resolution
const SRC_W = 1024; // downscaled source width
const SRC_H = 512; // downscaled source height
const MOSAIC_MAX = 1200; // composite long-side cap (px)
const DISC_RADIUS_FRAC = 0.35; // disc radius as a fraction of min(mosaic side)

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
 * Build a top-down aerial mosaic from the farm's 360° captures and return it
 * as a canvas to use as the 2D map background. Lazy (runs after paint) and
 * memoized on the capture set (ids + headings). Returns null — so the caller
 * keeps its normal background — when there are no captures or on any failure.
 * Live, browser-only, no storage.
 */
export function useAerialMosaic(farm: Farm, panoramas: FarmPanorama[]) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const key = panoramas.map((p) => `${p.id}:${p.heading_deg}`).join("|");
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    if (panoramas.length === 0) {
      setCanvas(null);
      setGenerating(false);
      return;
    }
    let disposed = false;

    const run = async () => {
      if (disposed || started.current) return;
      started.current = true;
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
        let drew = 0;
        for (const p of ordered) {
          if (disposed) return;
          try {
            const img = await loadImage(p.image_url);
            const disc = reprojectNadir(img, SRC_W, SRC_H, p.heading_deg, DISC);
            const cx = p.position_x * mw;
            const cy = p.position_y * mh;
            ctx.drawImage(disc, cx - radius, cy - radius, radius * 2, radius * 2);
            drew++;
          } catch {
            continue; // skip a photo that fails to load, reproject, or draw
          }
        }
        if (disposed) return;
        setCanvas(drew > 0 ? out : null);
      } catch {
        if (!disposed) setCanvas(null);
      } finally {
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
      const cic = (
        globalThis as unknown as {
          cancelIdleCallback?: (h: number) => void;
        }
      ).cancelIdleCallback;
      if (ric && cic) cic(handle);
      else window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, farm.canvas_width, farm.canvas_height]);

  return { canvas, generating };
}
