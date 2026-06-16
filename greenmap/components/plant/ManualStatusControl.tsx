"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ManualStatus } from "@/types/database";

const OPTS: { value: ManualStatus; label: string; color: string }[] = [
  { value: "healthy", label: "Healthy", color: "#0DB074" },
  { value: "attention", label: "Attention", color: "#F59E0B" },
  { value: "critical", label: "Critical", color: "#EF4444" },
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
