"use client";

import { useEffect, useState } from "react";

/**
 * Farm Map Dashboard — React port of the approved desktop HTML mockup.
 *
 * Self-contained on purpose: every colour is an explicit hex from the mockup
 * palette (#1E434A / #0DB074 / #F59E0B / #EF4444 / #3B82F6), NOT the app's
 * mobile design tokens, so it renders identically wherever it's dropped in.
 * Light/dark is a LOCAL `dark` state driving conditional classes (not the
 * Tailwind `dark:` variant) so the toggle works with no global theme config.
 */

type PlantId = "A" | "B" | "C" | "D" | "F";

interface PlantInfo {
  name: string;
  pct: number;
  loc: string;
  upd: string;
}

const DOT = "\u2022";

const PLANTS: Record<PlantId, PlantInfo> = {
  A: { name: "Tomato A", pct: 92, loc: `Zone A ${DOT} Row 12`, upd: "10 min ago" },
  B: { name: "Tomato B", pct: 68, loc: `Zone A ${DOT} Row 8`, upd: "25 min ago" },
  C: { name: "Tomato C", pct: 86, loc: `Zone B ${DOT} Row 3`, upd: "5 min ago" },
  D: { name: "Tomato D", pct: 32, loc: `Zone C ${DOT} Row 15`, upd: "1 hr ago" },
  F: { name: "Tomato F", pct: 55, loc: `Zone B ${DOT} Row 7`, upd: "40 min ago" },
};

const NODES: { id: PlantId; top: string; left: string }[] = [
  { id: "A", top: "24%", left: "28%" },
  { id: "B", top: "58%", left: "19%" },
  { id: "C", top: "36%", left: "62%" },
  { id: "D", top: "72%", left: "50%" },
  { id: "F", top: "30%", left: "82%" },
];

function statusOf(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Healthy", color: "#0DB074" };
  if (pct >= 50) return { label: "Needs Attention", color: "#F59E0B" };
  return { label: "Critical", color: "#EF4444" };
}

const KPIS: {
  label: string;
  value: string;
  color?: string;
  dot?: string;
  sub: string;
}[] = [
  { label: "Total Plants", value: "1,248", sub: "across all zones" },
  { label: "Healthy (>=80%)", value: "923", color: "#0DB074", dot: "#0DB074", sub: "stable crop health" },
  { label: "Needs Attention (50-79%)", value: "214", color: "#F59E0B", dot: "#F59E0B", sub: "review soon" },
  { label: "Critical / Alerts (<50%)", value: "67", color: "#EF4444", dot: "#EF4444", sub: "urgent intervention" },
  { label: "Ready For Harvest", value: "44", color: "#3B82F6", dot: "#3B82F6", sub: "at maturity" },
];

const svg: React.SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const NAV: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Dashboard",
    icon: (
      <svg {...svg}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Plant Detail",
    icon: (
      <svg {...svg}>
        <path d="M7 20h10" />
        <path d="M12 20v-9" />
        <path d="M12 11c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5Z" />
        <path d="M12 12C12 8.5 9 6 5 6c0 4 3 6 7 6Z" />
      </svg>
    ),
  },
  {
    label: "AI Diagnostics",
    icon: (
      <svg {...svg}>
        <path d="M3 12h4l2 6 4-14 2 8h6" />
      </svg>
    ),
  },
  {
    label: "Timeline",
    icon: (
      <svg {...svg}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    label: "Harvest Passport",
    icon: (
      <svg {...svg}>
        <path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1Z" />
        <path d="m9 11 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Marketplace",
    icon: (
      <svg {...svg}>
        <path d="M3 9h18l-1.5-5h-15L3 9Z" />
        <path d="M4 9v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
        <path d="M9 13h6" />
      </svg>
    ),
  },
];

export function FarmDashboard() {
  const [selected, setSelected] = useState<PlantId | null>("A");
  const [zoom, setZoom] = useState(1);
  const [dark, setDark] = useState(false);
  const [zone, setZone] = useState("Zone A");
  const [locOpen, setLocOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [navActive, setNavActive] = useState("Dashboard");

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleString("en-MY", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  function changeZoom(dir: number) {
    setZoom((z) => Math.min(1.6, Math.max(0.8, +(z + dir * 0.15).toFixed(2))));
  }

  const sel = selected ? PLANTS[selected] : null;
  const selStatus = sel ? statusOf(sel.pct) : null;

  const t = dark
    ? {
        page: "bg-[#0a1e23] text-slate-100",
        panel: "bg-[#0e2a30]",
        ring: "ring-white/10",
        border: "border-white/10",
        navText: "text-slate-300",
        navHover: "hover:bg-white/5 hover:text-white",
        chip: "bg-white/5 border-white/10",
      }
    : {
        page: "bg-[#F5F7F8] text-[#1E434A]",
        panel: "bg-white",
        ring: "ring-slate-100",
        border: "border-slate-200",
        navText: "text-slate-500",
        navHover: "hover:bg-slate-100 hover:text-[#1E434A]",
        chip: "bg-white border-slate-200",
      };

  const fieldStyle: React.CSSProperties = {
    backgroundColor: "#3c8f5e",
    backgroundImage: [
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 7px)",
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 64px)",
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 64px)",
      "linear-gradient(135deg, #2c7a4b 0%, #4aa56e 40%, #357f54 70%, #2f7d50 100%)",
    ].join(","),
    transform: `scale(${zoom})`,
    filter: dark ? "brightness(.82) saturate(.92)" : undefined,
    transition: "transform .25s ease, filter .3s ease",
  };

  const plots = [
    { top: "8%", left: "6%", width: "26%", height: "30%", background: "#6f8f3a", opacity: 0.5 },
    { top: "12%", left: "55%", width: "34%", height: "26%", background: "#2b6b46", opacity: 0.55 },
    { top: "58%", left: "10%", width: "30%", height: "32%", background: "#b79b54", opacity: 0.45 },
    { top: "62%", left: "60%", width: "30%", height: "28%", background: "#3f8a59", opacity: 0.5 },
    { top: "40%", left: "38%", width: "22%", height: "22%", background: "#7da245", opacity: 0.45 },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex h-dvh w-screen overflow-hidden font-sans ${t.page}`}>
      {/* ============ SIDEBAR ============ */}
      <aside className={`flex w-[280px] shrink-0 flex-col border-r ${t.border} ${t.panel} px-4 py-5`}>
        <div className="flex items-center gap-3 px-1">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1E434A] text-[#0DB074]">
            <svg {...svg} width={22} height={22}>
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-[17px] font-extrabold tracking-tight">GreenMap</p>
            <p className="text-[11px] font-medium text-slate-400">Codex Hackathon KL 2026</p>
          </div>
        </div>

        {/* Location dropdown */}
        <div className="relative mt-6">
          <button
            onClick={() => setLocOpen((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-xl border ${t.border} ${t.chip} px-3 py-2.5 text-left transition hover:border-[#0DB074]/50`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0DB074]/15 text-[#0DB074]">
              <svg {...svg} width={15} height={15}>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold">
                Sunway Smart Agro-Tech {DOT} {zone}
              </span>
              <span className="block text-[11px] text-slate-400">Location switcher</span>
            </span>
            <svg {...svg} width={16} height={16} className="text-slate-400">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {locOpen && (
            <div className={`absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border ${t.border} ${t.panel} shadow-lg`}>
              {["Zone A", "Zone B", "Zone C"].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZone(z);
                    setLocOpen(false);
                    setToast(`Switched to ${z}`);
                  }}
                  className="block w-full px-3 py-2 text-left text-[12.5px] hover:bg-[#0DB074]/10"
                >
                  {z}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-6 flex-1 space-y-1">
          {NAV.map((item) => {
            const active = item.label === navActive;
            return (
              <button
                key={item.label}
                onClick={() => setNavActive(item.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition ${
                  active
                    ? "bg-[#0DB074]/10 font-semibold text-[#0DB074]"
                    : `font-medium ${t.navText} ${t.navHover}`
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={() => setDark((v) => !v)}
          className={`mt-4 flex items-center justify-between rounded-xl border ${t.border} px-3 py-2.5`}
        >
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-400">
            {dark ? (
              <svg {...svg} width={16} height={16}>
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg {...svg} width={16} height={16}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
            {dark ? "Dark" : "Light"} mode
          </span>
          <span className={`relative h-6 w-11 rounded-full ${dark ? "bg-[#0DB074]" : "bg-slate-200"}`}>
            <span
              className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: dark ? "translateX(20px)" : "translateX(0)" }}
            />
          </span>
        </button>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-5">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">Farm Map Dashboard</h1>
            <p className="text-[12.5px] text-slate-400">
              Live crop health overview {DOT} {clock}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`hidden items-center gap-2 rounded-xl border ${t.border} ${t.chip} px-3 py-2 sm:flex`}>
              <svg {...svg} width={15} height={15} className="text-slate-400">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                placeholder="Search plants..."
                className="w-36 bg-transparent text-[12.5px] outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#1E434A] text-[12px] font-bold text-white">
              AZ
            </div>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-4 px-6 pt-4 md:grid-cols-3 xl:grid-cols-5">
          {KPIS.map((k) => (
            <div
              key={k.label}
              className={`rounded-2xl ${t.panel} p-4 shadow-sm ring-1 ${t.ring}`}
            >
              <div className="flex items-center gap-1.5">
                {k.dot && <span className="h-2 w-2 rounded-full" style={{ background: k.dot }} />}
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                  {k.label}
                </p>
              </div>
              <p
                className="mt-1.5 text-[28px] font-extrabold leading-none"
                style={{ color: k.color ?? (dark ? "#ffffff" : "#1E434A") }}
              >
                {k.value}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-400">{k.sub}</p>
            </div>
          ))}
        </section>

        {/* Map */}
        <section className={`relative m-6 mt-4 flex-1 overflow-hidden rounded-2xl shadow-sm ring-1 ${t.ring}`}>
          <div className="absolute inset-0 origin-center" style={fieldStyle}>
            {plots.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-md"
                style={{
                  top: p.top,
                  left: p.left,
                  width: p.width,
                  height: p.height,
                  background: p.background,
                  opacity: p.opacity,
                  mixBlendMode: "multiply",
                }}
              />
            ))}
            {NODES.map((n) => {
              const p = PLANTS[n.id];
              const s = statusOf(p.pct);
              const isSel = selected === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform hover:scale-105"
                  style={{ top: n.top, left: n.left, zIndex: isSel ? 30 : 10 }}
                >
                  <span
                    className="grid h-12 w-12 place-items-center rounded-full text-[13px] font-bold text-white shadow-lg ring-4 ring-white/80"
                    style={{
                      background: s.color,
                      boxShadow: isSel
                        ? "0 0 0 4px rgba(255,255,255,.9), 0 0 0 8px rgba(13,176,116,.45), 0 10px 24px rgba(0,0,0,.3)"
                        : undefined,
                    }}
                  >
                    {p.pct}%
                  </span>
                  <span className="mt-1.5 whitespace-nowrap rounded-md bg-[#1E434A] px-2 py-1 text-[11px] font-semibold text-white shadow">
                    {p.name} | {p.pct}% Health
                  </span>
                </button>
              );
            })}
          </div>

          {/* vignette */}
          <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 140px rgba(0,0,0,0.40)" }} />

          {/* Map controls */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
            <button
              onClick={() => changeZoom(1)}
              aria-label="Zoom in"
              className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[20px] font-semibold text-[#1E434A] shadow-md transition hover:bg-slate-50 active:scale-95"
            >
              +
            </button>
            <button
              onClick={() => changeZoom(-1)}
              aria-label="Zoom out"
              className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[22px] font-semibold text-[#1E434A] shadow-md transition hover:bg-slate-50 active:scale-95"
            >
              -
            </button>
            <button
              onClick={() => setZoom(1)}
              aria-label="Recenter"
              className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#1E434A] shadow-md transition hover:bg-slate-50 active:scale-95"
            >
              <svg {...svg}>
                <circle cx="12" cy="12" r="7" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Add plant */}
          <button
            onClick={() => setToast("Add Plant - demo action")}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-xl bg-[#0DB074] px-4 py-3 text-[14px] font-semibold text-white shadow-lg transition hover:brightness-105 active:scale-95"
          >
            <svg {...svg} strokeWidth={2.4}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Plant
          </button>

          {/* Drawer */}
          <aside
            className={`absolute right-4 top-4 z-30 w-72 rounded-2xl ${t.panel} p-5 shadow-2xl ring-1 ${t.ring} transition-all duration-300`}
            style={{
              transform: selected ? "translateX(0)" : "translateX(118%)",
              opacity: selected ? 1 : 0,
              pointerEvents: selected ? "auto" : "none",
            }}
          >
            {sel && selStatus && (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="text-[19px] font-bold leading-tight">{sel.name}</h3>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                    className={`grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition ${
                      dark ? "hover:bg-white/10 hover:text-white" : "hover:bg-slate-100 hover:text-[#1E434A]"
                    }`}
                  >
                    <svg {...svg} width={16} height={16} strokeWidth={2.2}>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 flex items-end gap-2">
                  <span className="text-[44px] font-extrabold leading-none" style={{ color: selStatus.color }}>
                    {sel.pct}%
                  </span>
                  <span className="mb-1 text-[14px] font-semibold" style={{ color: selStatus.color }}>
                    {selStatus.label}
                  </span>
                </div>

                <div className={`mt-3 h-2 w-full overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-slate-100"}`}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${sel.pct}%`, background: selStatus.color }}
                  />
                </div>

                <dl className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <dt className="text-[12.5px] text-slate-400">Location</dt>
                    <dd className="text-[12.5px] font-semibold">{sel.loc}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[12.5px] text-slate-400">Timestamp</dt>
                    <dd className="text-[12.5px] font-semibold">Last updated: {sel.upd}</dd>
                  </div>
                </dl>

                <button
                  onClick={() => setToast("Opening full plant detail...")}
                  className="mt-5 w-full rounded-xl bg-[#0DB074] py-3 text-[14px] font-semibold text-white shadow-lg transition hover:brightness-105 active:scale-[.98]"
                >
                  View Details
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className={`mt-2 w-full py-2 text-[13px] font-medium text-slate-400 transition ${
                    dark ? "hover:text-white" : "hover:text-[#1E434A]"
                  }`}
                >
                  Dismiss
                </button>
              </>
            )}
          </aside>
        </section>
      </main>

      {/* Toast */}
      <div
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#1E434A] px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl transition-opacity"
        style={{ opacity: toast ? 1 : 0, pointerEvents: "none" }}
      >
        {toast}
      </div>
    </div>
  );
}

export default FarmDashboard;
