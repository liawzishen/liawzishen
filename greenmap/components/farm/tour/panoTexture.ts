import * as THREE from "three";
import { fitWithin } from "./geometry";

/**
 * Loading 360° photos for the tour.
 *
 * - Bytes are fetched once per URL even if a prefetch and a hop ask for the
 *   same photo at the same moment.
 * - The photo is decoded off the main thread (`createImageBitmap`), so a large
 *   photo no longer freezes the page while it loads.
 * - The texture is never wider than MAX_PANO_TEXTURE_WIDTH. An 8K photo used
 *   to reach the GPU at full size (~180 MB with mipmaps); it is now ~45 MB.
 */

/** Widest texture sent to the GPU. 4096 px is sharp at every screen size we use. */
export const MAX_PANO_TEXTURE_WIDTH = 4096;

/** Downloads in flight, by URL. Entries are removed when they settle. */
const inFlight = new Map<string, Promise<Blob>>();

/**
 * Fetch a photo's bytes. Concurrent calls for one URL share one request;
 * afterwards the browser's HTTP cache serves repeats.
 */
export function fetchPanoBlob(url: string): Promise<Blob> {
  const pending = inFlight.get(url);
  if (pending) return pending;

  const request = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`photo request failed (${res.status})`);
      return res.blob();
    })
    .finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

function finish(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Shrink on a 2D canvas — the universal fallback when bitmap resize is unavailable. */
function shrinkOnCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number
): THREE.Texture | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new THREE.CanvasTexture(canvas);
}

async function decode(blob: Blob, maxWidth: number): Promise<THREE.Texture> {
  let bitmap = await createImageBitmap(blob);

  const target = fitWithin(bitmap.width, bitmap.height, maxWidth);
  if (target.resized) {
    try {
      // Off the main thread where the browser supports resize options.
      const scaled = await createImageBitmap(bitmap, {
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: "high",
      });
      if (scaled.width === target.width) {
        bitmap.close();
        bitmap = scaled;
      } else {
        scaled.close(); // options were ignored
      }
    } catch {
      /* resize options unsupported — handled just below */
    }
    if (bitmap.width > maxWidth) {
      const viaCanvas = shrinkOnCanvas(bitmap, target.width, target.height);
      if (viaCanvas) return finish(viaCanvas);
      // No 2D context either: three.js will clamp to the GPU limit itself.
    }
  }

  // WebGL never flips an ImageBitmap on upload (UNPACK_FLIP_Y is ignored for
  // them), so the flip is done in the texture's UV transform instead. This
  // works the same in every browser, with no bitmap options needed.
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false;
  texture.repeat.set(1, -1);
  texture.offset.set(0, 1);
  return finish(texture);
}

/** Older browsers without `createImageBitmap`: let three.js load an <img>. */
function loadWithImageElement(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => resolve(finish(texture)),
      undefined,
      () => reject(new Error("photo could not be loaded"))
    );
  });
}

/** Load a photo as a GPU-ready texture, at most `maxWidth` pixels wide. */
export async function loadPanoTexture(
  url: string,
  maxWidth: number
): Promise<THREE.Texture> {
  if (typeof createImageBitmap !== "function") return loadWithImageElement(url);
  return decode(await fetchPanoBlob(url), maxWidth);
}

/** Free a texture's GPU memory and its decoded pixels. */
export function disposePanoTexture(texture: THREE.Texture) {
  const image = texture.image as { close?: () => void } | null;
  texture.dispose();
  image?.close?.(); // ImageBitmap holds ~30 MB until closed
}
