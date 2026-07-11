"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import type { Farm, Plant } from "@/types/database";
import { worldSize, EYE_HEIGHT } from "./world";
import { PlantSprites } from "./PlantSprites";
import { WalkRig } from "./WalkRig";
import { GroundTexture } from "./GroundTexture";
import { Joystick } from "./Joystick";
import { useI18n } from "@/lib/i18n/LanguageProvider";

/**
 * First-person 3D walk mode for the Map tab (2026-07-11 plan): sky/fog +
 * textured ground (farm photo when present), plant marker sprites with
 * tap-to-open, drag-look/WASD walk rig, and a touch joystick overlay.
 * Client-only — imported via next/dynamic from FarmMap's 2D ⇄ 3D toggle.
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
  const { t } = useI18n();
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
      <Joystick moveRef={moveRef} />
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-label/80 px-4 py-1.5 text-[12px] font-medium text-white">
        {t.map.walkHint}
      </div>
    </div>
  );
}
