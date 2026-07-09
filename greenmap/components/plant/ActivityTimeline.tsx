"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Badge } from "@/components/ui/Badge";
import type {
  AiAnalysis,
  EventType,
  GrowthLog,
  Severity,
} from "@/types/database";

const META: Record<EventType, { icon: string; label: string }> = {
  planted: { icon: "🌱", label: "Planted" },
  water: { icon: "💧", label: "Watered" },
  fertilize: { icon: "🌿", label: "Fertilized" },
  ai_scan: { icon: "🔬", label: "AI Scan" },
  note: { icon: "📝", label: "Note" },
  harvested: { icon: "🧺", label: "Harvested" },
};

const SEV: Record<Severity, { label: string; tone: "brand" | "warning" | "critical" }> = {
  none: { label: "Healthy", tone: "brand" },
  mild: { label: "Mild", tone: "warning" },
  moderate: { label: "Moderate", tone: "warning" },
  severe: { label: "Severe", tone: "critical" },
};

function relative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A note that merely repeats the event label ("Watered" under "Watered")
 *  adds nothing — old task completions stored those. Show real notes only. */
function meaningfulNote(log: GrowthLog): string | null {
  const label = META[log.event_type]?.label ?? log.event_type;
  if (!log.note) return null;
  return log.note.trim().toLowerCase() === label.toLowerCase() ? null : log.note;
}

/** Link an ai_scan log to its ai_analyses row by nearest timestamp. */
function matchAnalysis(log: GrowthLog, analyses: AiAnalysis[]): AiAnalysis | null {
  if (log.event_type !== "ai_scan") return null;
  const t = new Date(log.created_at).getTime();
  let best: AiAnalysis | null = null;
  let bestDiff = Infinity;
  for (const a of analyses) {
    const d = Math.abs(new Date(a.created_at).getTime() - t);
    if (d < bestDiff) {
      bestDiff = d;
      best = a;
    }
  }
  return best && bestDiff <= 120000 ? best : null;
}

function severityBadge(md: Record<string, unknown>) {
  if (typeof md.severity !== "string") return null;
  const s = SEV[md.severity as Severity];
  return s ? <Badge tone={s.tone}>{s.label}</Badge> : null;
}

function MetaRows({ md }: { md: Record<string, unknown> }) {
  const rows: [string, string][] = [];
  if (typeof md.severity === "string")
    rows.push(["Severity", SEV[md.severity as Severity]?.label ?? cap(md.severity)]);
  if (typeof md.confidence === "number")
    rows.push(["Confidence", `${md.confidence}%`]);
  if (typeof md.fertilizer_type === "string")
    rows.push(["Fertilizer", md.fertilizer_type]);
  if (typeof md.amount === "string") rows.push(["Amount", md.amount]);
  if (typeof md.fertilizer_category === "string")
    rows.push(["Category", cap(md.fertilizer_category)]);
  if (md.pesticide_used === true)
    rows.push([
      "Pesticide",
      typeof md.pesticide_type === "string" ? md.pesticide_type : "Yes",
    ]);
  if (typeof md.method === "string") rows.push(["Method", cap(md.method)]);
  if (rows.length === 0) return null;
  return (
    <dl className="mt-4 space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between">
          <dt className="text-[13px] text-secondary">{k}</dt>
          <dd className="text-[13px] font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivityDetail({
  log,
  analysis,
}: {
  log: GrowthLog;
  analysis: AiAnalysis | null;
}) {
  const m = META[log.event_type] ?? { icon: "•", label: log.event_type };
  const md = (log.metadata ?? {}) as Record<string, unknown>;
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-fill text-[20px]">
          {m.icon}
        </span>
        <div>
          <h3 className="text-[18px] font-bold leading-tight">{m.label}</h3>
          <p className="text-[12px] text-secondary">
            {new Date(log.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {meaningfulNote(log) && (
        <p className="mt-4 text-[15px] leading-snug">{meaningfulNote(log)}</p>
      )}

      {analysis ? (
        <div className="mt-4 space-y-3">
          {analysis.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={analysis.image_url}
              alt="Scan photo"
              className="aspect-square w-full rounded-card object-cover"
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-secondary">Confidence</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-info"
                style={{ width: `${analysis.confidence}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold">{analysis.confidence}%</span>
          </div>
          {analysis.recommendations?.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
                Recommendations
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[14px]">
                    <span className="text-brand">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <MetaRows md={md} />
      )}
    </div>
  );
}

export function ActivityTimeline({
  logs,
  analyses = [],
}: {
  logs: GrowthLog[];
  analyses?: AiAnalysis[];
}) {
  const [selected, setSelected] = useState<GrowthLog | null>(null);

  if (logs.length === 0) {
    return <p className="text-center text-[14px] text-secondary">No activity yet.</p>;
  }

  return (
    <>
      <ol>
        {logs.map((log, i) => {
          const m = META[log.event_type] ?? { icon: "•", label: log.event_type };
          const md = (log.metadata ?? {}) as Record<string, unknown>;
          const last = i === logs.length - 1;
          return (
            <li key={log.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setSelected(log)}
                  aria-label={`${m.label} details`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[16px] active:opacity-70"
                >
                  {m.icon}
                </button>
                {!last && <span className="w-px flex-1 bg-tertiary" />}
              </div>
              <button
                type="button"
                onClick={() => setSelected(log)}
                className={`min-w-0 flex-1 text-left ${last ? "pb-1" : "pb-5"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold">{m.label}</span>
                  <span className="text-[12px] text-secondary">
                    {relative(log.created_at)}
                  </span>
                  <span className="ml-auto text-[18px] leading-none text-tertiary">
                    ›
                  </span>
                </div>
                {meaningfulNote(log) && (
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-secondary">
                    {meaningfulNote(log)}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {severityBadge(md)}
                  {typeof md.fertilizer_category === "string" && (
                    <Badge tone="neutral">{cap(md.fertilizer_category)}</Badge>
                  )}
                  {md.pesticide_used === true && (
                    <Badge tone="critical">Pesticide</Badge>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        ariaLabel="Activity detail"
      >
        {selected && (
          <ActivityDetail
            log={selected}
            analysis={matchAnalysis(selected, analyses)}
          />
        )}
      </BottomSheet>
    </>
  );
}
