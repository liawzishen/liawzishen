"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { FarmPanorama } from "@/types/database";
import { SPHERE_R } from "./geometry";
import { sphereYawRad } from "./aerial";

/**
 * Inverted sphere with the equirectangular photo on its inside. The mesh is
 * mirrored on X (equirect textures render mirrored from inside otherwise) and
 * rotated by `sphereYawRad(heading_deg)` so the photo centre faces its real
 * compass bearing — the SAME world->photo transform the 2D aerial reprojection
 * uses, so a heading calibrated here rotates the aerial correctly.
 * Children (plant pins, tag-aim surface) share the group so they stick to the
 * photo when the heading slider rotates it.
 */
export function PanoramaSphere({
  pano,
  onLoaded,
  onLoadError,
  children,
}: {
  pano: FarmPanorama;
  onLoaded?: () => void;
  onLoadError?: () => void;
  children?: React.ReactNode;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      pano.image_url,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
        onLoaded?.();
      },
      undefined,
      () => {
        if (!disposed) onLoadError?.();
      }
    );
    return () => {
      disposed = true;
      setTexture((prev) => {
        prev?.dispose();
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pano.image_url]);

  if (!texture) return null;

  return (
    <group rotation-y={sphereYawRad(pano.heading_deg)}>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[SPHERE_R, 64, 48]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
      {children}
    </group>
  );
}
