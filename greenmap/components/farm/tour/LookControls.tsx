"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const LOOK_SPEED = 0.0045; // radians per pointer px
const KEY_LOOK_SPEED = 1.4; // radians per second while a look key is held
const PITCH_LIMIT = (75 * Math.PI) / 180;

/**
 * Look keys → [yaw, pitch] direction. Yaw is POSITIVE to the left (a camera
 * rotated +y about Y faces (−sin θ, 0, −cos θ) — see geometry.toVec), so
 * "look right" subtracts. WASD mirrors the arrows for gamers/one-hand use.
 */
const LOOK_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  a: [1, 0],
  d: [-1, 0],
  w: [0, 1],
  s: [0, -1],
};

const clampPitch = (v: number) =>
  Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, v));

/**
 * Drag to look around from the sphere centre. Tracks a single pointerId so
 * multi-touch can't cross streams; left button only; pitch clamped ±75°.
 * Same feel as the old walk rig — movement removed (you hop, not walk).
 *
 * Keyboard parity: arrows/WASD steer the same yaw/pitch refs, but ONLY while
 * the tour viewport itself has focus — the listener hangs off `hostRef`, not
 * the window, so arrow keys keep scrolling the page everywhere else.
 */
export function LookControls({
  hostRef,
}: {
  /** The focusable element wrapping the canvas (role="application"). */
  hostRef: React.RefObject<HTMLElement | null>;
}) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const held = useRef(new Set<string>());

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
      pitch.current = clampPitch(
        pitch.current - (e.clientY - lastY) * LOOK_SPEED
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Single-character keys are normalised so Caps Lock / Shift still steer.
    const keyOf = (e: KeyboardEvent) =>
      e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
      const k = keyOf(e);
      if (!(k in LOOK_KEYS)) return;
      e.preventDefault(); // arrows would otherwise scroll the page under the tour
      held.current.add(k);
    };
    const up = (e: KeyboardEvent) => {
      held.current.delete(keyOf(e));
    };
    // focusout (bubbles) + window blur: a key held while focus/tab-switch
    // leaves would otherwise never see its keyup and spin the camera forever.
    const release = () => held.current.clear();
    host.addEventListener("keydown", down);
    host.addEventListener("keyup", up);
    host.addEventListener("focusout", release);
    window.addEventListener("blur", release);
    return () => {
      host.removeEventListener("keydown", down);
      host.removeEventListener("keyup", up);
      host.removeEventListener("focusout", release);
      window.removeEventListener("blur", release);
      release();
    };
  }, [hostRef]);

  useFrame((_, delta) => {
    if (held.current.size > 0) {
      // Clamp delta so a backgrounded tab doesn't resume with a huge jump.
      const step = KEY_LOOK_SPEED * Math.min(delta, 0.1);
      let dYaw = 0;
      let dPitch = 0;
      held.current.forEach((k) => {
        dYaw += LOOK_KEYS[k][0];
        dPitch += LOOK_KEYS[k][1];
      });
      yaw.current += dYaw * step;
      pitch.current = clampPitch(pitch.current + dPitch * step);
    }
    camera.position.set(0, 0, 0);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
  });

  return null;
}
