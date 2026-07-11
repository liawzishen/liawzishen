"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import type { Farm, Plant } from "@/types/database";
import { worldSize, EYE_HEIGHT } from "./world";
import { PlantSprites } from "./PlantSprites";
import { WalkRig } from "./WalkRig";
import { GroundTexture } from "./GroundTexture";

/**
 * First-person 3D walk mode for the Map tab (2026-07-11 plan). Skeleton:
 * sky, fog, light and a procedural ground plane. The walk rig, markers and
 * joystick land in Tasks 2–4. Client-only — imported via next/dynamic.
 */
export function FarmWalk({
  farm,
  plants,
  onMarkerClick,
  onBackgroundClick,
}: {
  farm: Farm;
  plants: Plant[];
  onMarkerClick: (plant: Plant) => void;
  onBackgroundClick?: () => void;
}) {
  const { w, d } = worldSize(farm);
  const moveRef = useRef({ x: 0, y: 0 });

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 70, position: [0, EYE_HEIGHT, d / 2 - 2], near: 0.1, far: 220 }}
        onPointerMissed={() => onBackgroundClick?.()}
      >
        <color attach="background" args={["#bfdcff"]} />
        <fog attach="fog" args={["#cfe6d8", 30, 140]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[20, 40, 10]} intensity={1.1} />
        <GroundTexture farm={farm} />
        {/* Horizon apron so the field doesn't float in the sky color */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[w * 8, d * 8]} />
          <meshLambertMaterial color="#8fb573" />
        </mesh>
        <PlantSprites farm={farm} plants={plants} onMarkerClick={onMarkerClick} />
        <WalkRig farm={farm} moveRef={moveRef} />
      </Canvas>
    </div>
  );
}
