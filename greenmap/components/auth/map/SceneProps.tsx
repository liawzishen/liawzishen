import type { CSSProperties } from "react";

/**
 * Decorative props for the rustic auth map — ported from the prototype's
 * AnimatedNature, with framer-motion swapped for CSS keyframes (auth-flit /
 * auth-buzz / auth-smoke / auth-flap, defined in globals.css). All are
 * `pointer-events-none` so the sun-cursor scene keeps its hover behaviour.
 */

/* ── Wooden GreenMap signboard ──────────────────────────────────────────── */
export function WoodenSign({
  title = "GreenMap",
  subtitle = "Empowering Farms & Connecting Tables.",
  className = "",
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const Bolt = ({ pos }: { pos: string }) => (
    <div className={`absolute ${pos} h-1.5 w-1.5 rounded-full bg-slate-500 ring-1 ring-slate-700`} />
  );
  return (
    <div className={`flex select-none flex-col items-center ${className}`}>
      <div className="relative flex max-w-[280px] flex-col items-center rounded-lg wood-border bg-wood-medium px-5 py-2.5 text-center shadow-md">
        {/* faux grain */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md opacity-15">
          <div className="my-1.5 h-px w-full bg-wood-dark" />
          <div className="my-2 h-px w-full bg-white" />
          <div className="my-1 h-px w-full bg-wood-dark" />
          <div className="my-3 h-px w-full bg-white" />
          <div className="my-1.5 h-px w-full bg-wood-dark" />
        </div>
        <Bolt pos="left-1.5 top-1" />
        <Bolt pos="right-1.5 top-1" />
        <Bolt pos="bottom-1 left-1.5" />
        <Bolt pos="bottom-1 right-1.5" />

        <div className="z-10 flex items-center gap-1.5">
          <span className="text-xl">🌿</span>
          {/* Logo/wordmark — intentionally not a heading so the form's <h1>
              stays the single page heading. */}
          <p className="font-rustic text-xl font-bold leading-none tracking-wider text-paper-light drop-shadow">
            {title}
          </p>
        </div>
        {subtitle && (
          <p className="z-10 mt-1.5 max-w-[230px] font-rustic text-[10px] font-medium leading-tight tracking-wide text-parchment drop-shadow-sm">
            {subtitle}
          </p>
        )}
      </div>
      {/* post */}
      <div className="-mt-1 h-12 w-3.5 border-x-[2.5px] border-b-[2.5px] border-wood-dark bg-wood-medium shadow-sm" />
    </div>
  );
}

/* ── Cozy cottage (chimney smoke = CSS) ─────────────────────────────────── */
export function CottageIllust({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none flex select-none flex-col items-center ${className}`}>
      <div className="relative h-28 w-40 drop-shadow-md">
        <svg width="160" height="110" viewBox="0 0 160 110" className="h-full w-full">
          <ellipse cx="80" cy="98" rx="65" ry="12" fill="rgba(79,119,45,0.15)" />
          <path
            d="M 12,85 L 12,100 M 18,85 L 18,100 M 24,85 L 24,100 M 10,92 L 26,92"
            stroke="#8b5a2b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 125,82 L 125,97 M 131,82 L 131,97 M 137,82 L 137,97 M 143,82 L 143,97 M 123,89 L 145,89"
            stroke="#8b5a2b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="35" y="55" width="85" height="40" fill="#ede0ca" stroke="#5c3a21" strokeWidth="2.5" rx="2" />
          <path
            d="M 28,60 L 77,25 L 128,60 L 120,64 L 77,33 L 36,64 Z"
            fill="#d0b07a"
            stroke="#5c3a21"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M 45,50 Q 55,42 65,36 M 55,54 Q 65,45 75,38 M 110,50 Q 100,42 90,36 M 100,54 Q 90,45 80,38"
            stroke="#a78650"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect x="96" y="22" width="14" height="24" fill="#a19482" stroke="#5c3a21" strokeWidth="2" />
          <rect x="94" y="20" width="18" height="5" fill="#5c3a21" rx="1" />
          <path d="M 70,68 L 70,95 L 88,95 L 88,68 Z" fill="#8b5a2b" stroke="#5c3a21" strokeWidth="2" />
          <circle cx="83" cy="81" r="1.5" fill="#f59e0b" />
          <rect x="46" y="65" width="16" height="16" fill="#fef08a" stroke="#5c3a21" strokeWidth="2" rx="1" />
          <path d="M 46,73 L 62,73 M 54,65 L 54,81" stroke="#5c3a21" strokeWidth="1.5" />
          <rect x="94" y="65" width="16" height="16" fill="#fef08a" stroke="#5c3a21" strokeWidth="2" rx="1" />
          <path d="M 94,73 L 110,73 M 102,65 L 102,81" stroke="#5c3a21" strokeWidth="1.5" />
          <path d="M 12,98 C 12,92 50,92 50,98 C 50,104 12,104 12,98 Z" fill="#6d4c41" stroke="#5c3a21" strokeWidth="1" />
          <circle cx="20" cy="97" r="2.5" fill="#4f772d" />
          <circle cx="28" cy="98" r="3" fill="#4f772d" />
          <circle cx="36" cy="97" r="2" fill="#4f772d" />
          <circle cx="44" cy="98" r="3.2" fill="#4f772d" />
          {/* chimney smoke — CSS puffs */}
          <circle
            cx="103"
            cy="12"
            r="3"
            fill="none"
            stroke="#a19482"
            strokeWidth="1"
            style={{ animation: "auth-smoke 4s ease-out infinite", transformOrigin: "103px 12px" } as CSSProperties}
          />
          <circle
            cx="103"
            cy="12"
            r="2.5"
            fill="none"
            stroke="#a19482"
            strokeWidth="1"
            style={{ animation: "auth-smoke 3.5s ease-out 1.8s infinite", transformOrigin: "103px 12px" } as CSSProperties}
          />
        </svg>
        <div className="absolute bottom-[-18px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded wood-border-sm bg-paper-light px-2 py-0.5 font-rustic text-[10px] font-medium text-wood-dark shadow-sm">
          🏡 <span className="tracking-wider">Hilltop Cottage</span>
        </div>
      </div>
    </div>
  );
}

/* ── Seed packet ────────────────────────────────────────────────────────── */
export function SeedPacket({
  name,
  icon,
  rotation = 12,
  className = "",
}: {
  name: string;
  icon: string;
  rotation?: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none relative flex h-16 w-12 select-none flex-col items-center justify-between rounded border border-amber-800 bg-amber-100 px-1.5 py-1 shadow-sm ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="h-1.5 w-full rounded-t bg-amber-700/80" />
      <span className="my-0.5 text-sm">{icon}</span>
      <div className="flex w-full items-center justify-center rounded wood-border-sm border-amber-800 bg-[#ede0ca] py-0.5">
        <span className="select-none font-rustic text-[7px] font-bold uppercase leading-none tracking-tight text-amber-900">
          {name}
        </span>
      </div>
    </div>
  );
}

/* ── Gardening tools ────────────────────────────────────────────────────── */
export function GardeningTools({
  type = "shovel",
  rotation = -45,
  className = "",
}: {
  type?: "shovel" | "pitchfork";
  rotation?: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {type === "shovel" ? (
        <svg width="18" height="42" viewBox="0 0 18 42" className="drop-shadow-sm">
          <rect x="8" y="10" width="2" height="22" fill="#8b5a2b" rx="0.5" stroke="#5c3a21" strokeWidth="0.5" />
          <path d="M 6,6 L 12,6 L 11,10 L 7,10 Z" fill="#8b5a2b" stroke="#5c3a21" strokeWidth="0.5" />
          <circle cx="9" cy="8" r="1.5" fill="#ede0ca" />
          <path d="M 4,32 C 4,32 4,40 9,41 C 14,40 14,32 14,32 Z" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
          <path d="M 9,32 L 9,38" stroke="#475569" strokeWidth="0.5" />
        </svg>
      ) : (
        <svg width="16" height="42" viewBox="0 0 16 42" className="drop-shadow-sm">
          <rect x="7" y="10" width="2" height="22" fill="#8b5a2b" rx="0.5" stroke="#5c3a21" strokeWidth="0.5" />
          <rect x="5" y="6" width="6" height="4" rx="1" fill="#8b5a2b" stroke="#5c3a21" strokeWidth="0.5" />
          <path d="M 4,32 L 12,32 L 12,34 Q 8,36 4,34 Z" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
          <rect x="4" y="34" width="1.5" height="7" rx="0.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
          <rect x="7.25" y="34" width="1.5" height="7" rx="0.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
          <rect x="10.5" y="34" width="1.5" height="7" rx="0.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
        </svg>
      )}
    </div>
  );
}

/* ── Butterfly (CSS wander + wing flap) ─────────────────────────────────── */
export function Butterfly({
  className = "",
  delay = 0,
  style,
}: {
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`auth-flit pointer-events-none absolute select-none ${className}`}
      style={{ animationDelay: `${delay}s`, ...style }}
    >
      <svg width="28" height="24" viewBox="0 0 28 24" className="fill-amber-600 stroke-wood-dark stroke-[1.5]">
        <path
          d="M 14,12 C 8,4 2,6 4,14 C 5,18 10,16 14,12 Z"
          style={{ animation: "auth-flap 0.6s ease-in-out infinite", transformOrigin: "right center" } as CSSProperties}
        />
        <path
          d="M 14,12 C 20,4 26,6 24,14 C 23,18 18,16 14,12 Z"
          style={{ animation: "auth-flap 0.6s ease-in-out 0.3s infinite", transformOrigin: "left center" } as CSSProperties}
        />
        <path d="M 13,8 C 13,6 15,6 15,8 L 14.5,16 L 13.5,16 Z" fill="#5c3a21" stroke="none" />
        <path d="M 14,8 Q 11,5 9,6 M 14,8 Q 17,5 19,6" stroke="#5c3a21" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}

/* ── Bumblebee (CSS wander + wing flap) ─────────────────────────────────── */
export function Bumblebee({
  className = "",
  delay = 0,
  style,
}: {
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`auth-buzz pointer-events-none absolute select-none ${className}`}
      style={{ animationDelay: `${delay}s`, ...style }}
    >
      <svg width="22" height="18" viewBox="0 0 22 18" className="drop-shadow-sm">
        <ellipse
          cx="9"
          cy="5"
          rx="5"
          ry="3"
          fill="rgba(255,255,255,0.75)"
          stroke="#5c3a21"
          strokeWidth="1"
          style={{ animation: "auth-flap 0.14s ease-in-out infinite", transformOrigin: "9px 5px" } as CSSProperties}
        />
        <ellipse
          cx="13"
          cy="5"
          rx="5"
          ry="3"
          fill="rgba(255,255,255,0.75)"
          stroke="#5c3a21"
          strokeWidth="1"
          style={{ animation: "auth-flap 0.14s ease-in-out 0.05s infinite", transformOrigin: "13px 5px" } as CSSProperties}
        />
        <rect x="5" y="7" width="12" height="8" rx="4" fill="#fbbf24" stroke="#5c3a21" strokeWidth="1.2" />
        <path d="M 8,7 L 8,15 M 11,7 L 11,15 M 14,7 L 14,15" stroke="#5c3a21" strokeWidth="1.5" />
        <circle cx="15" cy="10" r="1" fill="#5c3a21" />
        <path d="M 5,11 L 3,11" stroke="#5c3a21" strokeWidth="1.2" />
      </svg>
    </div>
  );
}
