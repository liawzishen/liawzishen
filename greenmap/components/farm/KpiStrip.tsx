const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Horizontally scrollable KPI strip (dashboard cards). Shared by the Map tab
 * and anywhere a farm-level health summary is needed.
 */
export function KpiStrip({
  total,
  healthy,
  attention,
  critical,
  ready,
}: {
  total: number;
  healthy: number;
  attention: number;
  critical: number;
  ready: number;
}) {
  const kpis = [
    {
      label: "Total Plants",
      value: total,
      color: "#1E434A",
      tint: "#1E434A1A",
      icon: (
        <svg {...iconProps}>
          <path d="M7 20h10" />
          <path d="M12 20v-9" />
          <path d="M12 11c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5Z" />
          <path d="M12 12C12 8.5 9 6 5 6c0 4 3 6 7 6Z" />
        </svg>
      ),
    },
    {
      label: "Healthy",
      value: healthy,
      color: "#0DB074",
      tint: "#0DB07419",
      icon: (
        <svg {...iconProps}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    },
    {
      label: "Needs Attention",
      value: attention,
      color: "#F59E0B",
      tint: "#F59E0B1A",
      icon: (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
        </svg>
      ),
    },
    {
      label: "Critical",
      value: critical,
      color: "#EF4444",
      tint: "#EF44441A",
      icon: (
        <svg {...iconProps}>
          <path d="M10.3 4 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ),
    },
    {
      label: "Ready For Harvest",
      value: ready,
      color: "#3B82F6",
      tint: "#3B82F61A",
      icon: (
        <svg {...iconProps}>
          <path d="M3 9h18l-1.6-5H4.6L3 9Z" />
          <path d="M4 9v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
          <path d="M9 13h6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-3 pb-1">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="w-[124px] shrink-0 rounded-card p-3 glass"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full"
              style={{ backgroundColor: k.tint, color: k.color }}
            >
              {k.icon}
            </span>
            <p
              className="mt-2 text-[22px] font-bold leading-none"
              style={{ color: k.color }}
            >
              {k.value}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-tight text-secondary">
              {k.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
