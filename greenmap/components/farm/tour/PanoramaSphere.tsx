"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { FarmPanorama } from "@/types/database";
import { SPHERE_R } from "./geometry";

/**
 * Inverted sphere with the equirectangular photo on its inside. The mesh is
 * mirrored on X (equirect textures render mirrored from inside otherwise) and
 * rotated by heading_deg so the photo centre faces its real compass bearing.
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
    let loaded: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.load(
      pano.image_url,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        loaded = tex;
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
      // Dispose directly: a state updater queued from an unmounting
      // component (every hop remounts via key) isn't guaranteed to run,
      // which would leak a full-size GPU texture per hop.
      loaded?.dispose();
      setTexture(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pano.image_url]);

  if (!texture) return null;

  return (
    <group rotation-y={THREE.MathUtils.degToRad(pano.heading_deg)}>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[SPHERE_R, 64, 48]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
      {children}
    </group>
  );
}
