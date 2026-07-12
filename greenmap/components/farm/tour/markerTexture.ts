import * as THREE from "three";
import type { HealthBand } from "@/lib/health/display";

const NODE_COLOR: Record<HealthBand, string> = {
  healthy: "#0DB074",
  attention: "#F59E0B",
  critical: "#EF4444",
  new: "#C7C7CC",
};

const cache = new Map<string, THREE.CanvasTexture>();

/** Draw the 2D marker style (colored disc + white ring + label) into a texture. */
export function markerTexture(band: HealthBand, label: string): THREE.CanvasTexture {
  const key = `${band}|${label}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const r = S / 2 - 8;

  ctx.beginPath();
  ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = NODE_COLOR[band];
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${label.length > 3 ? 26 : 34}px -apple-system, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, S / 2, S / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  cache.set(key, tex);
  return tex;
}
