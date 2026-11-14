"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FarmPanorama } from "@/types/database";
import { SPHERE_R } from "./geometry";
import {
  MAX_PANO_TEXTURE_WIDTH,
  disposePanoTexture,
  loadPanoTexture,
} from "./panoTexture";

const FADE_MS = 250;

/** One photo on screen: the panorama it belongs to and its GPU texture. */
type Layer = { id: string; url: string; texture: THREE.Texture };

/**
 * Shows the requested 360° photo on the inside of a sphere and crossfades to
 * the next one.
 *
 * The photo on screen stays until the next photo is downloaded, decoded and
 * on the GPU; only then does a 250 ms fade run. A hop therefore never shows a
 * blank frame, and a failed download leaves the farmer where they were.
 * After the fade the old texture is freed, so one photo is in GPU memory
 * between hops (two during a fade).
 *
 * Each sphere is mirrored on X (an equirectangular photo is mirrored when
 * seen from inside) and rotated by its panorama's heading_deg, read live from
 * `panoramas` so the "Set direction" slider turns the photo as it moves.
 */
export function PanoramaStage({
  target,
  attempt,
  panoramas,
  onShown,
  onFailed,
}: {
  /** The photo the farmer asked for. */
  target: FarmPanorama;
  /** Bumped to retry the same target after a failure. */
  attempt: number;
  panoramas: FarmPanorama[];
  /** The target is on screen (called when its fade starts). */
  onShown: (id: string) => void;
  /** The target could not be loaded; the previous photo is still shown. */
  onFailed: (id: string) => void;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  // Back-to-front: at most [previous, current]. The ref mirrors the state so
  // the frame loop and cleanup always see the latest list.
  const [layers, setLayers] = useState<Layer[]>([]);
  const layersRef = useRef<Layer[]>([]);
  const materials = useRef(new Map<string, THREE.MeshBasicMaterial>());
  const fadeStart = useRef<number | null>(null);
  const fading = useRef(false);
  // Textures taken off screen, waiting to be freed. A texture must only be
  // freed AFTER React has removed its sphere: one more frame drawn with a
  // freed texture makes three.js try to upload it again from closed pixels.
  const retired = useRef<THREE.Texture[]>([]);

  const callbacks = useRef({ onShown, onFailed });
  useEffect(() => {
    callbacks.current = { onShown, onFailed };
  });

  const commit = useCallback((next: Layer[]) => {
    layersRef.current = next;
    setLayers(next);
  }, []);
  const retire = useCallback((gone: Layer[]) => {
    retired.current.push(...gone.map((layer) => layer.texture));
  }, []);

  useEffect(() => {
    const front = layersRef.current.at(-1);
    if (front && front.id === target.id && front.url === target.image_url) {
      callbacks.current.onShown(target.id); // already on screen
      return;
    }

    let cancelled = false;
    const maxWidth = Math.min(
      MAX_PANO_TEXTURE_WIDTH,
      gl.capabilities.maxTextureSize
    );
    loadPanoTexture(target.image_url, maxWidth).then(
      (texture) => {
        if (cancelled) {
          disposePanoTexture(texture);
          return;
        }
        // Upload to the GPU now, so the fade itself never stalls on it.
        gl.initTexture(texture);

        const previous = layersRef.current;
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        // Keep the photo on screen underneath for the fade (none without motion).
        const kept = reduceMotion ? [] : previous.slice(-1);
        retire(previous.filter((layer) => !kept.includes(layer)));
        fadeStart.current = null; // stamped on the fade's first frame
        fading.current = !reduceMotion;
        commit([...kept, { id: target.id, url: target.image_url, texture }]);
        callbacks.current.onShown(target.id);
      },
      (error) => {
        if (cancelled) return;
        console.warn("[tour] photo failed to load:", error);
        callbacks.current.onFailed(target.id);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [target.id, target.image_url, attempt, gl, commit, retire]);

  // Runs after React has committed `layers`, i.e. once the retired spheres
  // are out of the scene — now their textures can be freed safely.
  useEffect(() => {
    const onScreen = new Set(layers.map((layer) => layer.texture));
    retired.current = retired.current.filter((texture) => {
      if (onScreen.has(texture)) return true;
      disposePanoTexture(texture);
      return false;
    });
  }, [layers]);

  // Leaving 3D mode: free every texture still held.
  useEffect(
    () => () => {
      for (const layer of layersRef.current) disposePanoTexture(layer.texture);
      for (const texture of retired.current) disposePanoTexture(texture);
      layersRef.current = [];
      retired.current = [];
    },
    []
  );

  useFrame(() => {
    const current = layersRef.current;
    let progress = 1;
    if (fading.current) {
      // Timed with our own clock: with on-demand rendering the frame delta
      // after an idle period would be seconds long and skip the whole fade.
      const now = performance.now();
      if (fadeStart.current === null) fadeStart.current = now;
      progress = Math.min(1, (now - fadeStart.current) / FADE_MS);
    }

    current.forEach((layer, i) => {
      const material = materials.current.get(layer.id);
      if (material) material.opacity = i === current.length - 1 ? progress : 1;
    });

    if (!fading.current) return;
    if (progress < 1) {
      invalidate(); // keep rendering until the fade ends
      return;
    }
    fading.current = false;
    if (current.length > 1) {
      retire(current.slice(0, -1));
      commit(current.slice(-1));
    }
  });

  return (
    <>
      {layers.map((layer, i) => {
        const heading =
          panoramas.find((p) => p.id === layer.id)?.heading_deg ?? 0;
        return (
          <group key={layer.id} rotation-y={THREE.MathUtils.degToRad(heading)}>
            {/* Painter's order, no depth: old photo, new photo, then markers. */}
            <mesh scale={[-1, 1, 1]} renderOrder={i - 2}>
              <sphereGeometry args={[SPHERE_R, 64, 48]} />
              <meshBasicMaterial
                ref={(material) => {
                  if (material) materials.current.set(layer.id, material);
                  else materials.current.delete(layer.id);
                }}
                map={layer.texture}
                side={THREE.BackSide}
                transparent
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
