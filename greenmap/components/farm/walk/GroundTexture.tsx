"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { Farm } from "@/types/database";
import { worldSize } from "./world";

/**
 * Field plane textured with the farm's uploaded/satellite photo when one
 * exists — the same image the 2D map shows, so 2D→3D feels like the same
 * place. Falls back to flat green (no texture) while loading or when absent.
 */
export function GroundTexture({ farm }: { farm: Farm }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const { w, d } = worldSize(farm);

  useEffect(() => {
    const usable =
      farm.background_url &&
      (farm.background_type === "upload" || farm.background_type === "satellite");
    if (!usable) {
      setTex(null);
      return;
    }
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(farm.background_url!, (t) => {
      if (disposed) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      setTex(t);
    });
    return () => {
      disposed = true;
      setTex((prev) => {
        prev?.dispose();
        return null;
      });
    };
  }, [farm.background_url, farm.background_type]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[w, d]} />
      {tex ? (
        <meshLambertMaterial map={tex} />
      ) : (
        <meshLambertMaterial color="#79a35c" />
      )}
    </mesh>
  );
}
