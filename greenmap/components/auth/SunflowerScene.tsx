"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Interactive sunflower ecology for the auth screen.
 *
 * Organic, alive, never a rigid row:
 *  - 5 sunflowers with seeded variance (height, scale, rest tilt, sway) and a
 *    two-layer grass field (back + front) whose blades criss-cross and overlap
 *    the stems for depth.
 *  - Full X/Y heliotropism. Each flower is an inline SVG; one requestAnimationFrame
 *    LERP loop drives all of them so they bend, straighten and recover with mass.
 *      • Sun ABOVE  → stem stretches + straightens, head lifts, leaves perk up.
 *      • Sun BELOW  → stem stoops/bows, head pitches down, leaves fold.
 *      • Sun L / R  → stem bows that way (Δx), root pinned to the grass.
 *      • Idle       → a relaxed, slightly-nodding rest posture (per-flower tilt).
 *  - STEM: cubic Bézier spine (anchored root). HEAD: group on the live tip,
 *    Math.atan2 toward the cursor (pitch up/down). LEAVES: ride the curve and
 *    open/fold with the vertical reach.
 *
 * Desktop: native cursor hidden page-wide, replaced by a glowing sun (eased).
 * Mobile: gyro feeds the pointer on both axes; tap = sun-flare + gust.
 *
 * Auth states:
 *  - Register: empty → idle muted curve; first keystroke → vibrant healthy
 *    baseline; each criterion → green flash + permanent grow; 4/4 → bloom with
 *    floating green/gold particles; lost criterion → red flash + step down.
 *  - Login: 3 lives. miss1 shudder/−10%/dim · miss2 shudder/droop/−10%/gray ·
 *    miss3 lockout: tracking off, head collapses, dead brown + falling petals.
 *
 * All window / gyro / cursor work runs post-mount → hydration-safe.
 */

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

type Props = {
  mode: "login" | "register";
  penalty?: number;
  /** Register only: number of password criteria met (0-4). */
  strength?: number;
  /** Register only: true once the user has typed anything. */
  typing?: boolean;
  locked?: boolean;
};

// SVG coordinate system, one per flower. Root pinned at the bottom centre.
const SVG_W = 120;
const SVG_H = 224;
const BASE_X = 60;
const BASE_Y = 224;

// Seeded per-flower variance — deterministic (hydration-safe), not a tidy row.
const FLOWERS = [
  { left: 13, stem: 110, scale: 0.9, tilt: -8, sway: 0.7, phase: 0.0 },
  { left: 31, stem: 136, scale: 1.04, tilt: 5, sway: 0.55, phase: 1.3 },
  { left: 50, stem: 124, scale: 0.98, tilt: -4, sway: 0.82, phase: 2.1 },
  { left: 69, stem: 146, scale: 1.07, tilt: 9, sway: 0.5, phase: 0.7 },
  { left: 86, stem: 116, scale: 0.93, tilt: -6, sway: 0.74, phase: 2.8 },
];
const PETALS = Array.from({ length: 12 }, (_, i) => i * 30);

// Two grass layers. Back sits behind the flowers; front is short and overlaps
// the stem bases. Criss-crossing rotations + varied height/opacity = depth.
const GRASS_BACK = Array.from({ length: 16 }, (_, i) => ({
  left: 2 + i * 6.3,
  h: 30 + ((i * 41) % 26),
  rot: ((i * 53) % 24) - 12,
  op: 0.28 + ((i * 17) % 30) / 100,
  dur: 3.2 + ((i * 13) % 22) / 10,
  delay: ((i * 7) % 16) / 10,
}));
const GRASS_FRONT = Array.from({ length: 12 }, (_, i) => ({
  left: 5 + i * 8.4,
  h: 18 + ((i * 29) % 16),
  rot: ((i * 67) % 30) - 15,
  op: 0.5 + ((i * 23) % 35) / 100,
  dur: 2.8 + ((i * 11) % 18) / 10,
  delay: ((i * 9) % 14) / 10,
}));

const BEND_MAX = 22; // max horizontal bow of the tip (svg units)
const BEND_DIV = 240; // px of mouse travel for a full horizontal bow
const REACH_DIV = 220; // px for a full vertical straighten/bow
const STRETCH = 0.1; // stem length change at full reach (±10%)
const IDLE_AMP = 2.6;
const HEAD_CLAMP = 134; // head may crane this far from "up" (deg) before lockout

export function SunflowerScene({
  mode,
  penalty = 0,
  strength = 0,
  typing = false,
  locked = false,
}: Props) {
  void locked; // visual lock is driven by `penalty`

  const sunRef = useRef<HTMLDivElement>(null);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stemRefs = useRef<(SVGPathElement | null)[]>([]);
  const leafARefs = useRef<(SVGGElement | null)[]>([]);
  const leafBRefs = useRef<(SVGGElement | null)[]>([]);
  const headRefs = useRef<(SVGGElement | null)[]>([]);

  const mouse = useRef({ x: 0, y: 0 });
  const sunTarget = useRef({ x: 0, y: 0 });
  const sunEase = useRef({ x: 0, y: 0 });
  const bendCur = useRef<number[]>(FLOWERS.map(() => 0));
  const reachCur = useRef<number[]>(FLOWERS.map(() => 0));
  const angCur = useRef<number[]>(FLOWERS.map((f) => f.tilt));
  const gust = useRef<number[]>(FLOWERS.map(() => 0));
  const prevStrength = useRef(strength);
  const rectsRef = useRef<DOMRect[]>([]);
  const reducedMotion = useRef(false);

  const withered = mode === "login" && penalty >= 3;
  const maxed = mode === "register" && typing && strength >= 4;

  // Live params for the loop (no re-subscription needed).
  const paramsRef = useRef({ withered, trackFactor: 1, droopBias: 0, vBias: -0.08 });
  {
    const lv = Math.min(penalty, 3);
    const isReg = mode === "register";
    paramsRef.current = {
      withered,
      trackFactor: isReg ? (typing ? 1 : 0.6) : [1, 0.7, 0.45, 0][lv],
      droopBias: isReg ? 0 : [0, 9, 20, 0][lv],
      vBias: isReg && !typing ? -0.26 : -0.08, // empty register rests nodding
    };
  }

  const [isDesktop, setIsDesktop] = useState(false);
  const [flares, setFlares] = useState<{ id: number; x: number; y: number }[]>([]);
  const [shudder, setShudder] = useState(false);
  const [flash, setFlash] = useState<"none" | "gain" | "loss">("none");
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setIsDesktop(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  // Login: shudder on each new failed attempt.
  useEffect(() => {
    if (mode !== "login" || penalty <= 0) return;
    setShudder(true);
    const t = setTimeout(() => setShudder(false), 520);
    return () => clearTimeout(t);
  }, [penalty, mode]);

  // Register: flash + particle burst when strength changes.
  useEffect(() => {
    if (mode !== "register") {
      prevStrength.current = strength;
      return;
    }
    const prev = prevStrength.current;
    prevStrength.current = strength;
    if (strength === prev) return;
    if (strength > prev) {
      setFlash("gain");
      setBurst((b) => b + 1);
    } else {
      setFlash("loss");
    }
    const t = setTimeout(() => setFlash("none"), 460);
    return () => clearTimeout(t);
  }, [strength, mode]);

  // ── Heliotropism engine: one LERP loop for sun + all stems/heads/leaves. ──
  useEffect(() => {
    mouse.current = { x: window.innerWidth / 2, y: window.innerHeight * 0.28 };
    sunTarget.current = { ...mouse.current };
    sunEase.current = { ...mouse.current };
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Container rects are stable (fixed-size SVGs positioned by %/bottom), so
    // measure once and re-measure only on resize / scroll — never per frame.
    // This removes a forced layout reflow on every animation frame.
    const measure = () => {
      rectsRef.current = FLOWERS.map(
        (_, i) => containerRefs.current[i]?.getBoundingClientRect() as DOMRect
      );
    };
    measure();
    const scene = containerRefs.current[0]?.parentElement ?? null;
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && scene) ro.observe(scene);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });

    // Hoisted out of the loop — one closure instead of one per flower per frame.
    const bez = (t: number, a: number, b: number, c: number, d: number) => {
      const u = 1 - t;
      return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    };

    const t0 = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      const time = (now - t0) / 1000;
      const p = paramsRef.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      // eased sun cursor
      if (sunRef.current) {
        sunEase.current.x += (sunTarget.current.x - sunEase.current.x) * 0.28;
        sunEase.current.y += (sunTarget.current.y - sunEase.current.y) * 0.28;
        sunRef.current.style.transform = `translate(${sunEase.current.x - 20}px, ${
          sunEase.current.y - 20
        }px)`;
      }

      FLOWERS.forEach((f, i) => {
        const rect = rectsRef.current[i];
        const stem = stemRefs.current[i];
        const head = headRefs.current[i];
        if (!rect || !stem || !head) return;

        const sx = rect.width / SVG_W;
        const sy = rect.height / SVG_H;
        const baseScreenX = rect.left + rect.width / 2;
        const tipY0 = BASE_Y - f.stem;
        const headRefY = rect.top + tipY0 * sy;
        const idle = reducedMotion.current
          ? 0
          : Math.sin(time * f.sway + f.phase) * IDLE_AMP;

        gust.current[i] *= 0.9;

        // ---- vertical reach: + straighten (sun above), − bow (sun below) ----
        let reachTarget: number;
        let bendTarget: number;
        if (p.withered) {
          reachTarget = -1;
          bendTarget = -6 + idle * 0.4;
        } else {
          reachTarget =
            Math.max(-1, Math.min(1, (headRefY - my) / REACH_DIV)) *
              p.trackFactor +
            p.vBias;
          const lean =
            Math.max(-1, Math.min(1, (mx - baseScreenX) / BEND_DIV)) *
            BEND_MAX *
            p.trackFactor;
          bendTarget = lean + idle + gust.current[i] + f.tilt * 0.9;
        }
        reachCur.current[i] += (reachTarget - reachCur.current[i]) * 0.1;
        bendCur.current[i] += (bendTarget - bendCur.current[i]) * 0.12;
        const reach = reachCur.current[i];
        const bend = bendCur.current[i];

        // stem length stretches up / compresses down with reach
        const stemEff = f.stem * (1 + STRETCH * reach);
        const tipY = BASE_Y - stemEff;

        // cubic Bézier spine — root fixed, curvature grows toward the top
        const c1x = BASE_X + bend * 0.15;
        const c1y = BASE_Y - stemEff * 0.35;
        const c2x = BASE_X + bend * 0.7;
        const c2y = BASE_Y - stemEff * 0.72;
        const tipX = BASE_X + bend;
        stem.setAttribute(
          "d",
          `M ${BASE_X} ${BASE_Y} C ${c1x.toFixed(2)} ${c1y.toFixed(
            2
          )}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${tipX.toFixed(2)} ${tipY.toFixed(
            2
          )}`
        );

        // leaves ride the curve and open (perk) / fold with reach
        const leafA = leafARefs.current[i];
        const leafB = leafBRefs.current[i];
        if (leafA) {
          const lx = bez(0.42, BASE_X, c1x, c2x, tipX);
          const ly = bez(0.42, BASE_Y, c1y, c2y, tipY);
          const rot = -18 - reach * 26; // up when reaching, down when bowing
          leafA.setAttribute(
            "transform",
            `translate(${lx.toFixed(2)} ${ly.toFixed(2)}) rotate(${rot.toFixed(2)})`
          );
        }
        if (leafB) {
          const lx = bez(0.64, BASE_X, c1x, c2x, tipX);
          const ly = bez(0.64, BASE_Y, c1y, c2y, tipY);
          const rot = 18 + reach * 26;
          leafB.setAttribute(
            "transform",
            `translate(${lx.toFixed(2)} ${ly.toFixed(2)}) rotate(${rot.toFixed(2)})`
          );
        }

        // ---- head: stare at the sun (pitch up / down via atan2) ----
        const headScreenX = rect.left + tipX * sx;
        const headScreenY = rect.top + tipY * sy;
        let angTarget: number;
        if (p.withered) {
          angTarget = 176; // collapsed, facing the soil
        } else {
          const a =
            Math.atan2(my - headScreenY, mx - headScreenX) * (180 / Math.PI) + 90;
          angTarget =
            Math.max(-HEAD_CLAMP, Math.min(HEAD_CLAMP, a)) * p.trackFactor +
            p.droopBias +
            f.tilt * 0.5;
        }
        const delta = ((angTarget - angCur.current[i] + 540) % 360) - 180;
        angCur.current[i] += delta * 0.14;
        head.setAttribute(
          "transform",
          `translate(${tipX.toFixed(2)} ${tipY.toFixed(2)}) rotate(${angCur.current[
            i
          ].toFixed(2)})`
        );
      });

      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    // Pause the loop while the tab is hidden (no wasted CPU in the background).
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        measure();
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
    };
  }, []);

  // Pointer sources.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      sunTarget.current = { x: e.clientX, y: e.clientY };
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // L/R tilt
      const beta = e.beta ?? 45; // F/B tilt
      mouse.current = {
        x: window.innerWidth * Math.min(1, Math.max(0, 0.5 + gamma / 90)),
        y: window.innerHeight * Math.min(1, Math.max(0, (beta - 10) / 80)),
      };
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  // Touch flare + gust, keystroke gust, iOS gyro permission on first touch.
  useEffect(() => {
    let fid = 0;
    let gyroAsked = false;
    const doGust = () => {
      gust.current = gust.current.map((_, i) => (i % 2 ? -1 : 1) * 12);
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) {
        const id = ++fid;
        setFlares((f) => [...f, { id, x: t.clientX, y: t.clientY }]);
        window.setTimeout(
          () => setFlares((f) => f.filter((p) => p.id !== id)),
          720
        );
        mouse.current = { x: t.clientX, y: t.clientY };
        sunTarget.current = { x: t.clientX, y: t.clientY };
      }
      if (!gyroAsked) {
        gyroAsked = true;
        const D = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>;
        };
        if (D && typeof D.requestPermission === "function") {
          D.requestPermission().catch(() => {});
        }
      }
      doGust();
    };
    const onKey = () => doGust();
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── State-driven appearance (colour / scale / glow) — React, eased by CSS ──
  function visual() {
    if (mode === "register") {
      if (!typing) {
        return {
          scale: 0.9,
          brightness: 0.96,
          saturate: 0.72,
          open: 0.92,
          petalFill: "#E9C766",
          center: "#7A5A38",
          stem: "#4A7D46",
          leaf: "#6FA060",
          glow: 0,
        };
      }
      const s = Math.max(0, Math.min(4, strength));
      return {
        scale: 1 + s * 0.06, // 1.00 → 1.24
        brightness: 1 + s * 0.03,
        saturate: 1 + s * 0.1,
        open: 1,
        petalFill: "#F6C544",
        center: "#6B4A2B",
        stem: "#3E7D3A",
        leaf: "#4C9145",
        glow: s,
      };
    }
    const lv = Math.min(penalty, 3);
    return {
      scale: [1, 0.9, 0.8, 0.72][lv],
      brightness: [1, 0.8, 0.62, 0.45][lv],
      saturate: [1, 0.72, 0.36, 0.1][lv],
      open: [1, 1, 0.82, 0.6][lv],
      petalFill: ["#F6C544", "#F6C544", "#C9B98C", "#8A7250"][lv],
      center: ["#6B4A2B", "#6B4A2B", "#5A4A36", "#42372A"][lv],
      stem: ["#3E7D3A", "#3E7D3A", "#5E6B43", "#6B5A43"][lv],
      leaf: ["#4C9145", "#4C9145", "#7E8A5E", "#7A6A52"][lv],
      glow: 0,
    };
  }

  function filterFor(vv: ReturnType<typeof visual>) {
    const base = `brightness(${vv.brightness}) saturate(${vv.saturate})`;
    if (flash === "gain")
      return `${base} drop-shadow(0 0 15px rgba(34,197,94,0.95))`;
    if (flash === "loss")
      return `${base} drop-shadow(0 0 13px rgba(239,68,68,0.9))`;
    if (vv.glow > 0)
      return `${base} drop-shadow(0 0 ${4 + vv.glow * 2}px rgba(34,197,94,${
        0.1 + vv.glow * 0.1
      }))`;
    return base;
  }

  const v = visual();
  const flashScale = flash === "gain" ? 1.08 : flash === "loss" ? 0.9 : 1;

  return (
    <div
      className="sf-scene relative h-56 w-full select-none overflow-visible sm:h-60"
      aria-hidden
    >
      <style>{`
        @keyframes sf-grass { 0%,100% { transform: rotate(var(--r)) skewX(-3deg); } 50% { transform: rotate(var(--r)) skewX(3deg); } }
        @keyframes sf-shudder { 0%,100% { transform: translateX(0); } 15% { transform: translateX(-4px); } 35% { transform: translateX(4px); } 55% { transform: translateX(-3px); } 75% { transform: translateX(2px); } }
        @keyframes sf-flare { from { opacity: .55; transform: scale(.4); } to { opacity: 0; transform: scale(1.7); } }
        @keyframes sf-twinkle { 0%,100% { opacity: 0; transform: scale(.5); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes sf-particle { 0% { opacity: 0; transform: translate(0,0) scale(.4); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--px), -38px) scale(1); } }
        @keyframes sf-float { 0% { opacity: 0; transform: translate(0,6px) scale(.5); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--px), -42px) scale(1); } }
        @keyframes sf-fall { 0% { opacity: 1; transform: translate(0,0) rotate(0deg); } 100% { opacity: 0; transform: translate(var(--px), 120px) rotate(160deg); } }
        .sf-grass-blade { animation: sf-grass var(--d) ease-in-out var(--delay) infinite; }
        .sf-shudder { animation: sf-shudder .5s ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .sf-grass-blade, .sf-shudder { animation: none !important; }
        }
      `}</style>

      {/* hide the native cursor page-wide on desktop */}
      {isDesktop && <style>{`* { cursor: none !important; }`}</style>}

      {/* soft sky glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFF7DF] via-[#F2FAEE] to-transparent" />

      {/* back grass (behind flowers) */}
      <div className="absolute inset-x-0 bottom-0 h-16">
        {GRASS_BACK.map((g, i) => (
          <div
            key={i}
            className="sf-grass-blade absolute bottom-0 origin-bottom"
            style={
              {
                left: `${g.left}%`,
                opacity: g.op,
                "--r": `${g.rot}deg`,
                "--d": `${g.dur}s`,
                "--delay": `${g.delay}s`,
              } as CSSVars
            }
          >
            <div
              className="w-[3px] rounded-t-full bg-[#7FAE68]"
              style={{ height: `${g.h}px` }}
            />
          </div>
        ))}
      </div>

      {/* sunflowers */}
      {FLOWERS.map((f, i) => {
        const tipY0 = BASE_Y - f.stem;
        const headScale = f.scale * v.scale * flashScale;
        return (
          <div
            key={i}
            ref={(el) => {
              containerRefs.current[i] = el;
            }}
            className={`absolute bottom-0 ${shudder ? "sf-shudder" : ""}`}
            style={{ left: `${f.left}%`, width: SVG_W, marginLeft: -SVG_W / 2 }}
          >
            <svg
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="block overflow-visible"
            >
              {/* stem spine */}
              <path
                ref={(el) => {
                  stemRefs.current[i] = el;
                }}
                d={`M ${BASE_X} ${BASE_Y} C ${BASE_X} ${BASE_Y - f.stem * 0.35}, ${BASE_X} ${BASE_Y - f.stem * 0.72}, ${BASE_X} ${tipY0}`}
                fill="none"
                stroke={v.stem}
                strokeWidth="5"
                strokeLinecap="round"
                style={{ transition: "stroke .4s ease" }}
              />

              {/* leaves */}
              <g
                ref={(el) => {
                  leafARefs.current[i] = el;
                }}
                transform={`translate(${BASE_X} ${BASE_Y - f.stem * 0.42}) rotate(-18)`}
              >
                <ellipse
                  cx="9"
                  cy="0"
                  rx="11"
                  ry="5"
                  fill={v.leaf}
                  style={{ transition: "fill .4s ease" }}
                />
              </g>
              <g
                ref={(el) => {
                  leafBRefs.current[i] = el;
                }}
                transform={`translate(${BASE_X} ${BASE_Y - f.stem * 0.64}) rotate(18)`}
              >
                <ellipse
                  cx="-9"
                  cy="0"
                  rx="11"
                  ry="5"
                  fill={v.leaf}
                  style={{ transition: "fill .4s ease" }}
                />
              </g>

              {/* head — on the live tip, rotated to stare at the sun */}
              <g
                ref={(el) => {
                  headRefs.current[i] = el;
                }}
                transform={`translate(${BASE_X} ${tipY0})`}
              >
                <g
                  style={{
                    transform: `scale(${headScale})`,
                    transformOrigin: "0 0",
                    transition:
                      "transform .4s cubic-bezier(.16,1,.3,1), filter .35s ease",
                    filter: filterFor(v),
                  }}
                >
                  <g
                    style={{
                      transform: `scale(${v.open})`,
                      transformOrigin: "0 0",
                      transition: "transform .5s cubic-bezier(.16,1,.3,1)",
                    }}
                  >
                    {PETALS.map((deg) => (
                      <ellipse
                        key={deg}
                        cx="0"
                        cy="-24"
                        rx="6"
                        ry="15"
                        fill={v.petalFill}
                        style={{ transition: "fill .4s ease" }}
                        transform={`rotate(${deg})`}
                      />
                    ))}
                  </g>
                  <circle r="13" fill={v.center} style={{ transition: "fill .4s ease" }} />
                  <circle
                    r="13"
                    fill="none"
                    stroke="rgba(0,0,0,0.12)"
                    strokeWidth="1.5"
                  />
                </g>
              </g>
            </svg>

            {/* 4/4 bloom: floating green + gold particles */}
            {maxed && (
              <div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                style={{ top: `${tipY0}px` }}
              >
                {[-20, -8, 8, 20, -14, 14].map((px, k) => (
                  <span
                    key={k}
                    className="absolute block h-1.5 w-1.5 rounded-full"
                    style={
                      {
                        background: k % 2 ? "#FFC93C" : "#34C759",
                        "--px": `${px}px`,
                        animation: `sf-float ${1.6 + (k % 3) * 0.3}s ease-in-out ${
                          k * 0.18
                        }s infinite`,
                      } as CSSVars
                    }
                  />
                ))}
              </div>
            )}

            {/* per-gain particle burst */}
            {mode === "register" && typing && burst > 0 && (
              <div
                key={burst}
                className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                style={{ top: `${tipY0}px` }}
              >
                {[-18, -6, 6, 18, 0, -12].map((px, k) => (
                  <span
                    key={k}
                    className="absolute block h-1.5 w-1.5 rounded-full"
                    style={
                      {
                        background: "#34C759",
                        "--px": `${px}px`,
                        animation: `sf-particle .8s ease-out ${k * 0.04}s both`,
                      } as CSSVars
                    }
                  />
                ))}
              </div>
            )}

            {/* lockout: falling dead petals */}
            {withered && (
              <div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                style={{ top: `${tipY0}px` }}
              >
                {[-10, 4, 14].map((px, k) => (
                  <span
                    key={k}
                    className="absolute block h-2.5 w-1.5 rounded-full bg-[#8A7250]"
                    style={
                      {
                        left: `${px}px`,
                        "--px": `${px * 1.4}px`,
                        animation: `sf-fall ${1.4 + k * 0.3}s ease-in ${
                          k * 0.2
                        }s forwards`,
                      } as CSSVars
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* front grass (overlaps stem bases for depth) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10">
        {GRASS_FRONT.map((g, i) => (
          <div
            key={i}
            className="sf-grass-blade absolute bottom-0 origin-bottom"
            style={
              {
                left: `${g.left}%`,
                opacity: g.op,
                "--r": `${g.rot}deg`,
                "--d": `${g.dur}s`,
                "--delay": `${g.delay}s`,
              } as CSSVars
            }
          >
            <div
              className="w-[3.5px] rounded-t-full bg-[#5E9B4E]"
              style={{ height: `${g.h}px` }}
            />
          </div>
        ))}
      </div>

      {/* desktop sun cursor (fixed → follows the mouse anywhere) */}
      {isDesktop && (
        <div
          ref={sunRef}
          className="pointer-events-none fixed left-0 top-0 z-[60] h-10 w-10 rounded-full"
          style={{
            background:
              "radial-gradient(circle, #FFE08A 0%, #FFC93C 45%, rgba(255,201,60,0) 72%)",
            boxShadow: "0 0 22px 8px rgba(255,201,60,0.55)",
          }}
        />
      )}

      {/* mobile tap flares */}
      {flares.map((fl) => (
        <div
          key={fl.id}
          className="pointer-events-none fixed z-[60] h-24 w-24 rounded-full"
          style={{
            left: fl.x - 48,
            top: fl.y - 48,
            background:
              "radial-gradient(circle, rgba(255,224,138,0.8) 0%, rgba(255,201,60,0.25) 45%, rgba(255,201,60,0) 70%)",
            animation: "sf-flare .7s ease-out forwards",
          }}
        />
      ))}
    </div>
  );
}
