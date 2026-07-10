"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AddPlantModal } from "./AddPlantModal";
import { PlantBottomSheet } from "./PlantBottomSheet";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Farm, Plant, Zone } from "@/types/database";

const FarmMapCanvas = dynamic(
  () => import("./FarmMapCanvas").then((m) => m.FarmMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-[15px] text-secondary">
        Loading map…
      </div>
    ),
  }
);

export function FarmMap({
  farm,
  zones,
  initialPlants,
  className,
}: {
  farm: Farm;
  zones: Zone[];
  initialPlants: Plant[];
  /** Height override — the responsive field page sizes the card per layout. */
  className?: string;
}) {
  const { t } = useI18n();
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [placing, setPlacing] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [careOnly, setCareOnly] = useState(false);
  // Single source of truth for the open pin (D10) — one selectedPlant, no
  // per-pin multi-click state. A single tap sets it (opens the sheet); the
  // sheet's CTA handles navigation to the full detail page.
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);

  // Plants needing care (drives the optional highlight filter).
  const careIds = useMemo(
    () =>
      plants
        .filter(
          (p) =>
            p.lifecycle_status === "active" &&
            (p.manual_status !== "healthy" ||
              (p.health_score !== null && p.health_score < 70))
        )
        .map((p) => p.id),
    [plants]
  );

  // After a quick-log, push the recalculated score into the marker + sheet.
  function applyScore(plantId: string, newScore: number | null) {
    setPlants((prev) =>
      prev.map((p) =>
        p.id === plantId ? { ...p, health_score: newScore } : p
      )
    );
    setSelectedPlant((prev) =>
      prev && prev.id === plantId ? { ...prev, health_score: newScore } : prev
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-card bg-card shadow-card",
        className ?? "h-[calc(100dvh-210px)]"
      )}
    >
      <FarmMapCanvas
        farm={farm}
        plants={plants}
        placing={placing}
        highlightIds={careOnly ? careIds : null}
        selectedId={selectedPlant?.id ?? null}
        onPlace={(pos) => {
          setPendingPos(pos);
          setPlacing(false);
        }}
        onMarkerClick={(plant) => {
          if (placing) return; // don't open the sheet while placing a plant
          setSelectedPlant(plant); // single tap → open the bottom sheet
        }}
        onBackgroundClick={() => setSelectedPlant(null)}
      />

      {/* Empty-state overlay */}
      {plants.length === 0 && !placing && !pendingPos && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-card bg-white/85 px-5 py-3 text-center text-[14px] font-medium text-secondary shadow-card backdrop-blur">
            {t.map.firstPlant}
          </div>
        </div>
      )}

      {/* Care filter toggle (only if some plants need care) */}
      {careIds.length > 0 && !placing && (
        <button
          type="button"
          onClick={() => setCareOnly((v) => !v)}
          className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-card backdrop-blur transition ${
            careOnly ? "bg-warning text-white" : "bg-white/95 text-warning"
          }`}
        >
          {careOnly ? t.map.showingNeedCare : t.map.needCare(careIds.length)}
        </button>
      )}

      {/* Placement hint */}
      {placing && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-label/85 px-4 py-2 text-[13px] font-medium text-white">
          {t.map.tapWhere}
        </div>
      )}

      {/* Add-plant FAB */}
      <button
        type="button"
        onClick={() => {
          setPlacing((v) => !v);
          setSelectedPlant(null);
        }}
        aria-label={placing ? "Cancel placement" : "Add plant"}
        className="absolute bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-[28px] text-white shadow-fab transition active:scale-95"
      >
        {placing ? "✕" : "＋"}
      </button>

      {pendingPos && (
        <AddPlantModal
          farmId={farm.id}
          zones={zones}
          position={pendingPos}
          onCancel={() => setPendingPos(null)}
          onCreated={(plant) => {
            setPlants((prev) => [...prev, plant]);
            setPendingPos(null);
          }}
        />
      )}

      {/* Single-tap progressive disclosure: plant summary + quick actions */}
      <PlantBottomSheet
        plant={selectedPlant}
        farmId={farm.id}
        onClose={() => setSelectedPlant(null)}
        onLogged={applyScore}
      />
    </div>
  );
}
