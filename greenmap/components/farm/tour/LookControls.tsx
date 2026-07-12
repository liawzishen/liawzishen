"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const LOOK_SPEED = 0.0045; // radians per pointer px
const PITCH_LIMIT = (75 * Math.PI) / 180;

/**
 * Drag to look around from the sphere centre. Tracks a single pointerId so
 * multi-touch can't cross streams; left button only; pitch clamped ±75°.
 * Same feel as the old walk rig — movement removed (you hop, not walk).
 */
export function LookControls() {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    let activeId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || activeId !== null) return;
      activeId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      yaw.current -= (e.clientX - lastX) * LOOK_SPEED;
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current - (e.clientY - lastY) * LOOK_SPEED)
      );
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === activeId) activeId = null;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame(() => {
    camera.position.set(0, 0, 0);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
  });

  return null;
}
