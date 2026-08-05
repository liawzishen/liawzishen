"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ManualStatus } from "@/types/database";

/*
 * The selected option is a solid fill with a white label, so the fill must
 * carry the 4.5:1 — the previous hexes put white at 2.81:1 (green),
 * 2.15:1 (amber) and 3.76:1 (red). These are the app's ink tokens, which
 * clear 5.2:1, 6.8:1 and 7.8:1 respectively.
 */
const OPTS: { value: ManualStatus; label: string; activeClass: string }[] = [
  { value: "healthy", label: "Healthy", activeClass: "bg-brand text-white" },
  { value: "attention", label: "Attention", activeClass: "bg-warning-ink text-white" },
  { value: "critical", label: "Critical", activeClass: "bg-critical-ink text-white" },
];

/**
 * Grower-set health status. Optimistically highlights the choice, writes
 * plants.manual_status, then asks the server to recalculate the score and
 * refreshes the page so the score, trend and timeline update.
 */
export function ManualStatusControl({
  plantId,
  current,
}: {
  plantId: string;
  current: ManualStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ManualStatus>(current);
  const [saving, setSaving] = useState(false);

  async function choose(next: ManualStatus) {
    if (next === status || saving) return;
    const prev = status;
    setStatus(next);
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("plants")
      .update({ manual_status: next })
      .eq("id", plantId);
    if (error) {
      setStatus(prev);
      setSaving(false);
      return;
    }

    try {
      await fetch("/api/health/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId }),
      });
    } catch {
      // log saved; score refresh is best-effort
    }

    setSaving(false);
    router.refresh();
  }

  return (
    // One status out of three — a radiogroup. Previously three plain
    // buttons: the group had no name, and which one was chosen was carried
    // entirely by a colour swap that nothing could report.
    <div
      role="radiogroup"
      aria-label="Plant health status"
      aria-busy={saving || undefined}
      className="grid grid-cols-3 gap-2"
    >
      {OPTS.map((o) => {
        const active = status === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            disabled={saving}
            className={`rounded-input py-2.5 text-[13px] font-semibold transition disabled:opacity-70 ${
              active ? o.activeClass : "bg-fill text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
