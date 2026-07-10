"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogModal, type LogType } from "@/components/farm/LogModal";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Plant } from "@/types/database";

const TILES: { type: LogType; icon: string }[] = [
  { type: "water", icon: "💧" },
  { type: "fertilize", icon: "🌿" },
  { type: "note", icon: "📝" },
];

/**
 * Quick-action tiles on the plant detail page. Water/Fertilize/Note open the
 * shared LogModal (insert + recalculate); on success we refresh so the score,
 * trend and timeline update. AI Scan links to the Phase 6 scan flow.
 * Tiles are deliberately tall (field use: gloves, sunlight, one thumb).
 */
export function PlantQuickActions({
  plant,
  scanHref,
}: {
  plant: Plant;
  scanHref: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [logType, setLogType] = useState<LogType | null>(null);

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {TILES.map((tile) => (
          <button
            key={tile.type}
            type="button"
            onClick={() => setLogType(tile.type)}
            className="pressable flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-squarcle py-3 glass"
          >
            <span className="text-[26px]">{tile.icon}</span>
            <span className="text-[12px] font-semibold">
              {t.quick[tile.type]}
            </span>
          </button>
        ))}
        <Link
          href={scanHref}
          className="pressable flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-squarcle py-3 glass"
        >
          <span className="text-[26px]">🔬</span>
          <span className="text-[12px] font-semibold">{t.quick.scan}</span>
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
