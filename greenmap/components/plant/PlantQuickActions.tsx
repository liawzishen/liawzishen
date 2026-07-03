"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogModal, type LogType } from "@/components/farm/LogModal";
import type { Plant } from "@/types/database";

const TILES: { type: LogType; icon: string; label: string }[] = [
  { type: "water", icon: "💧", label: "Water" },
  { type: "fertilize", icon: "🌿", label: "Fertilize" },
  { type: "note", icon: "📝", label: "Note" },
];

/**
 * Quick-action tiles on the plant detail page. Water/Fertilize/Note open the
 * shared LogModal (insert + recalculate); on success we refresh so the score,
 * trend and timeline update. AI Scan links to the Phase 6 scan flow.
 */
export function PlantQuickActions({
  plant,
  scanHref,
}: {
  plant: Plant;
  scanHref: string;
}) {
  const router = useRouter();
  const [logType, setLogType] = useState<LogType | null>(null);

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {TILES.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => setLogType(t.type)}
            className="flex flex-col items-center gap-1.5 rounded-squarcle py-3 glass active:opacity-80"
          >
            <span className="text-[22px]">{t.icon}</span>
            <span className="text-[11px] font-medium">{t.label}</span>
          </button>
        ))}
        <Link
          href={scanHref}
          className="flex flex-col items-center gap-1.5 rounded-squarcle py-3 glass active:opacity-80"
        >
          <span className="text-[22px]">🔬</span>
          <span className="text-[11px] font-medium">AI Scan</span>
        </Link>
      </div>

      {logType && (
        <LogModal
          plant={plant}
          type={logType}
          onClose={() => setLogType(null)}
          onLogged={() => router.refresh()}
        />
      )}
    </>
  );
}
