"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Farm } from "@/types/database";
import { worldSize, EYE_HEIGHT } from "./world";

const SPEED = 5; // world units / second (~brisk walk)
const LOOK_SPEED = 0.0045; // radians per pointer px
const PITCH_LIMIT = (75 * Math.PI) / 180;

/**
 * First-person rig: drag on the canvas to look (yaw/pitch), move via the
 * shared moveRef vector (keyboard here; joystick writes the same ref).
 * Position is clamped to the field with a 1-unit margin. No physics — YAGNI.
 */
export function WalkRig({
  farm,
  moveRef,
}: {
  farm: Farm;
  moveRef: React.RefObject<{ x: number; y: number }>;
}) {
  const { camera, gl } = useThree();
  const yaw = useRef(0); // yaw 0 faces -z — into the field from the spawn edge
  const pitch = useRef(0);
  const keys = useRef({ f: 0, b: 0, l: 0, r: 0 });

  // Pointer-drag look — attached to the WebGL canvas only, so the DOM
  // joystick (a sibling overlay) never fights it.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= (e.clientX - lastX) * LOOK_SPEED;
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current - (e.clientY - lastY) * LOOK_SPEED)
      );
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  // WASD / arrow keys (desktop)
  useEffect(() => {
    const set = (e: KeyboardEvent, v: number) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keys.current.f = v;
      else if (k === "s" || k === "arrowdown") keys.current.b = v;
      else if (k === "a" || k === "arrowleft") keys.current.l = v;
      else if (k === "d" || k === "arrowright") keys.current.r = v;
      else return;
      e.preventDefault();
    };
    const dn = (e: KeyboardEvent) => set(e, 1);
    const up = (e: KeyboardEvent) => set(e, 0);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    const k = keys.current;
    const j = moveRef.current ?? { x: 0, y: 0 };
    const fwd = Math.max(-1, Math.min(1, k.f - k.b + j.y));
    const strafe = Math.max(-1, Math.min(1, k.r - k.l + j.x));
    const step = SPEED * Math.min(dt, 0.05); // clamp dt (tab-switch spikes)

    camera.position.x +=
      (Math.sin(yaw.current) * -fwd + Math.cos(yaw.current) * strafe) * step;
    camera.position.z +=
      (Math.cos(yaw.current) * -fwd - Math.sin(yaw.current) * strafe) * step;

    const { w, d } = worldSize(farm);
    camera.position.x = Math.max(-w / 2 + 1, Math.min(w / 2 - 1, camera.position.x));
    camera.position.z = Math.max(-d / 2 + 1, Math.min(d / 2 - 1, camera.position.z));
    camera.position.y = EYE_HEIGHT;
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
  });

  return null;
}
