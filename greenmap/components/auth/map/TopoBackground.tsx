"use client";

import { useEffect, useRef } from "react";

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

/**
 * Parchment "adventure map" backdrop for the auth scene — ported from the
 * prototype's TopoBackground, restyled onto the rustic tokens.
 *
 * Pure decoration: `pointer-events-none` so it never steals hover from the
 * interactive sunflower scene layered above it. When `interactive`, the whole
 * map drifts a few pixels with the cursor for a subtle parallax (disabled for
 * reduced-motion). Fills its nearest positioned ancestor.
 */

// Faint contour + trail path data (SVG viewBox 0 0 1200 800).
const CONTOURS = [
  "M -50,-50 C 50,50 150,0 200,-50",
  "M -100,-100 C 100,100 250,50 350,-100",
  "M -150,-150 C 150,150 350,100 500,-150",
  "M -200,-200 C 200,200 450,150 650,-200",
  "M -250,-250 C 250,250 550,200 800,-250",
  "M 1200,800 C 1100,750 1000,850 1050,950",
  "M 1300,700 C 1150,650 900,800 1000,1050",
  "M 1400,600 C 1200,550 800,750 950,1150",
  "M 1500,500 C 1250,450 700,700 900,1250",
  "M 100,500 C 250,550 400,450 550,550 C 700,650 900,550 1000,600",
  "M 300,100 C 450,120 600,50 750,150 C 900,250 1100,200 1200,100",
];

const TRAILS = [
  "M 180,180 Q 280,120 380,180 T 520,240",
  "M 520,240 Q 380,320 220,450 T 260,700",
  "M 260,700 Q 450,750 620,680",
  "M 520,240 Q 700,350 850,550 T 1000,750",
  "M 1000,750 Q 1100,550 950,400",
];

export function TopoBackground({
  interactive = false,
}: {
  interactive?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interactive) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dx = (e.clientX / window.innerWidth - 0.5) * 14;
        const dy = (e.clientY / window.innerHeight - 0.5) * 14;
        if (rootRef.current) {
          rootRef.current.style.setProperty("--px", `${dx}px`);
          rootRef.current.style.setProperty("--py", `${dy}px`);
        }
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [interactive]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden bg-parchment"
      style={{ "--px": "0px", "--py": "0px" } as CSSVars}
    >
      {/* Surveyor's grid */}
      <div className="topo-grid absolute inset-0 opacity-[0.35]" />

      {/* Elevation contour lines */}
      <svg
        className="absolute h-full w-full fill-none stroke-wood-dark opacity-[0.14]"
        style={{
          transform: "translate(var(--px), var(--py))",
          transition: "transform .3s ease-out",
          strokeWidth: 1.2,
        }}
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        {CONTOURS.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <text x="180" y="240" fill="#5c3a21" opacity="0.4" fontSize="10" fontFamily="monospace">
          140m
        </text>
        <text x="960" y="580" fill="#5c3a21" opacity="0.4" fontSize="10" fontFamily="monospace">
          210m
        </text>
      </svg>

      {/* Concentric rings, bottom-right */}
      <div
        className="absolute bottom-[-150px] right-[-150px] flex h-[500px] w-[500px] items-center justify-center rounded-full border border-wood-medium/10 opacity-70"
        style={{ transform: "translate(calc(var(--px) * 0.5), calc(var(--py) * 0.5))" }}
      >
        <div className="flex h-[380px] w-[380px] items-center justify-center rounded-full border border-wood-medium/10">
          <div className="flex h-[260px] w-[260px] items-center justify-center rounded-full border border-wood-medium/10">
            <div className="h-[140px] w-[140px] rounded-full border border-wood-medium/10" />
          </div>
        </div>
      </div>

      {/* Dashed exploration trails */}
      <svg
        className="absolute inset-0 h-full w-full fill-none stroke-wood-medium opacity-[0.28]"
        style={{
          transform: "translate(calc(var(--px) * 0.8), calc(var(--py) * 0.8))",
          transition: "transform .3s ease-out",
          strokeWidth: 1.5,
          strokeDasharray: "4 6",
        }}
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        {TRAILS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>

      {/* Compass rose, top-right */}
      <div className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-wood-dark/25 bg-paper-light/60 text-wood-dark/70 shadow-sm">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
          <path d="M13 3 L15.4 11 L13 13 L10.6 11 Z" fill="#b23b2e" />
          <path d="M13 23 L10.6 15 L13 13 L15.4 15 Z" fill="#5c3a21" />
          <circle cx="13" cy="13" r="1.3" fill="#5c3a21" />
        </svg>
        <span className="absolute left-1/2 top-[1px] -translate-x-1/2 text-[8px] font-bold leading-none">
          N
        </span>
      </div>
    </div>
  );
}
