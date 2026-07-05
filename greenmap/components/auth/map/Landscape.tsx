import type { CSSProperties } from "react";

/**
 * Hybrid landscape "window" for the left 62% of the auth split.
 *
 * Coded + animated: a blue-sky gradient, drifting CSS clouds, and stylized
 * terraced-hill bands with a winding path — all hand-built so it themes and
 * animates. On top of the coded hills sits a `background-image` layer pointed
 * at `/landscape-hills.png`: while that file is absent nothing renders there
 * (no broken-image icon) and the coded bands show; drop a painterly PNG in
 * `public/` and it upgrades in place — no code change.
 *
 * The right edge feathers into the parchment so the illustration "meets the
 * blank margin of the map" rather than ending on a hard line.
 */

type CSSVars = CSSProperties & Record<`--${string}`, string>;

const CLOUDS = [
  { top: "14%", left: "12%", w: 150, h: 34, op: 0.9, d: "58s", delay: "0s" },
  { top: "24%", left: "54%", w: 110, h: 26, op: 0.8, d: "72s", delay: "-20s" },
  { top: "38%", left: "30%", w: 180, h: 40, op: 0.7, d: "86s", delay: "-40s" },
  { top: "9%", left: "72%", w: 90, h: 22, op: 0.75, d: "64s", delay: "-12s" },
];

export function Landscape({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative h-full w-full overflow-hidden rounded-l-[28px] rounded-r-[10px] border border-wood-medium/25 shadow-[inset_0_0_70px_rgba(92,58,33,0.14)] ${className}`}
    >
      {/* sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#8fc7f0] via-[#c3e2f4] to-[#e9f4e2]" />

      {/* drifting clouds */}
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="auth-drift absolute rounded-full bg-white"
          style={
            {
              top: c.top,
              left: c.left,
              width: c.w,
              height: c.h,
              opacity: c.op,
              filter: "blur(9px)",
              "--d": c.d,
              animationDelay: c.delay,
            } as CSSVars
          }
        />
      ))}

      {/* coded terraced hills (placeholder under the optional PNG) */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[58%] w-full"
        viewBox="0 0 600 350"
        preserveAspectRatio="xMidYMax slice"
      >
        {/* far rolling hill */}
        <path d="M0,150 C120,110 240,120 360,150 C460,175 540,165 600,150 L600,350 L0,350 Z" fill="#bcd98a" />
        {/* terrace bands */}
        <path d="M0,190 C130,150 250,165 380,195 C470,215 545,205 600,195 L600,350 L0,350 Z" fill="#a3c86f" />
        <path d="M0,235 C120,200 260,215 390,240 C480,258 550,250 600,242 L600,350 L0,350 Z" fill="#8bb658" />
        <path d="M0,282 C140,250 270,262 400,285 C490,300 555,295 600,290 L600,350 L0,350 Z" fill="#72a047" />
        <path d="M0,325 C150,300 280,308 410,325 C500,337 560,334 600,332 L600,350 L0,350 Z" fill="#5c8a3a" />
        {/* terrace contour lines */}
        <g stroke="#4d7731" strokeWidth="1.2" fill="none" opacity="0.35">
          <path d="M0,196 C130,158 250,172 380,201 C470,220 545,211 600,201" />
          <path d="M0,241 C120,207 260,221 390,246 C480,263 550,256 600,248" />
          <path d="M0,288 C140,257 270,268 400,290 C490,305 555,300 600,296" />
        </g>
        {/* winding dirt path */}
        <path
          d="M300,150 C280,190 340,220 320,255 C300,295 360,315 340,350"
          stroke="#c19a68"
          strokeWidth="20"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M300,150 C280,190 340,220 320,255 C300,295 360,315 340,350"
          stroke="#a9814f"
          strokeWidth="20"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 16"
          opacity="0.5"
        />
      </svg>

      {/* Painterly landscape (full scene) — covers the coded fallback above
          when the file exists in /public; renders nothing while it's absent,
          so the coded sky + hills show through as a graceful placeholder. */}
      <div
        className="absolute inset-0 bg-no-repeat"
        style={{
          backgroundImage: "url('/landscape.png')",
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
        }}
      />

      {/* feather the right edge into the parchment margin */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-r from-transparent to-parchment" />
    </div>
  );
}
