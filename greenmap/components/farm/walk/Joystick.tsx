"use client";

import { useRef } from "react";

const SIZE = 104; // outer diameter px
const KNOB = 46;

/**
 * DOM joystick (bottom-left) writing a normalized {x,y} vector into moveRef
 * — read per-frame by WalkRig, so dragging never re-renders React. y is
 * +forward (up on the stick), x is +right.
 */
export function Joystick({
  moveRef,
}: {
  moveRef: React.RefObject<{ x: number; y: number }>;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);

  function apply(clientX: number, clientY: number) {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    const rect = base.getBoundingClientRect();
    const max = (SIZE - KNOB) / 2;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (moveRef.current) {
      moveRef.current.x = dx / max;
      moveRef.current.y = -dy / max; // screen-up = forward
    }
  }

  function reset() {
    active.current = false;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    if (moveRef.current) {
      moveRef.current.x = 0;
      moveRef.current.y = 0;
    }
  }

  return (
    <div
      ref={baseRef}
      style={{ width: SIZE, height: SIZE, touchAction: "none" }}
      className="absolute bottom-4 left-4 z-10 rounded-full border-2 border-white/70 bg-black/15 backdrop-blur-sm"
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current) apply(e.clientX, e.clientY);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      aria-hidden
    >
      <div
        ref={knobRef}
        style={{ width: KNOB, height: KNOB }}
        className="absolute left-1/2 top-1/2 -ml-[23px] -mt-[23px] rounded-full bg-white/90 shadow-card"
      />
    </div>
  );
}
