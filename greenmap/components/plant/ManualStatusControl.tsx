"use client";

import { useState } from "react";
import { useRefreshData } from "@/lib/router/refresh";
import { postJson } from "@/lib/api/client";
import type { ManualStatus } from "@/types/database";

const OPTS: { value: ManualStatus; label: string; color: string }[] = [
  { value: "healthy", label: "Healthy", color: "#0DB074" },
  { value: "attention", label: "Attention", color: "#F59E0B" },
  { value: "critical", label: "Critical", color: "#EF4444" },
];

/**
 * Grower-set health status. Optimistically highlights the choice, then
 * /api/plants/status saves it and recalculates the score; the page is
 * refreshed so the score, trend and timeline update.
 */
export function ManualStatusControl({
  plantId,
  current,
}: {
  plantId: string;
  current: ManualStatus;
}) {
  const refreshData = useRefreshData();
  const [status, setStatus] = useState<ManualStatus>(current);
  const [saving, setSaving] = useState(false);

  async function choose(next: ManualStatus) {
    if (next === status || saving) return;
    const prev = status;
    setStatus(next);
    setSaving(true);

    const result = await postJson("/api/plants/status", { plantId, status: next });
    if (!result.ok) {
      setStatus(prev);
      setSaving(false);
      return;
    }

    setSaving(false);
    refreshData();
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTS.map((o) => {
        const active = status === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            disabled={saving}
            className={`rounded-input py-2.5 text-[13px] font-semibold transition disabled:opacity-70 ${
              active ? "text-white" : "bg-fill text-secondary"
            }`}
            style={active ? { backgroundColor: o.color } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
