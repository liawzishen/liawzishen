"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogModal, type LogType } from "./LogModal";
import { healthDisplay } from "@/lib/health/display";
import type { Plant } from "@/types/database";

const QUICK: { type: LogType; icon: string; label: string }[] = [
  { type: "water", icon: "💧", label: "Water" },
  { type: "fertilize", icon: "🌿", label: "Fertilize" },
  { type: "note", icon: "📝", label: "Note" },
];

/**
 * Progressive-disclosure bottom sheet shown on a single pin tap (D10).
 * Surfaces the basics — name, type, exact score + status, planted date —
 * plus quick-log actions and a prominent "View More Details" CTA to the full
 * plant page. Tapping a quick action opens the matching LogModal.
 */
export function PlantBottomSheet({
  plant,
  farmId,
  onClose,
  onLogged,
}: {
  plant: Plant | null;
  farmId: string;
  onClose: () => void;
  onLogged: (plantId: string, newScore: number | null) => void;
}) {
  // Retain the last plant so the sheet keeps its content while it slides out.
  const [shown, setShown] = useState<Plant | null>(plant);
  const [logType, setLogType] = useState<LogType | null>(null);

  useEffect(() => {
    if (plant) setShown(plant);
  }, [plant]);

  const display = shown ? healthDisplay(shown.health_score) : null;
  const scoreText =
    shown && shown.health_score !== null ? `${shown.health_score}` : null;

  return (
    <>
      <BottomSheet
        open={!!plant}
        onClose={onClose}
        ariaLabel={shown ? `${shown.name} summary` : "Plant summary"}
      >
        {shown && display && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-[22px] font-bold leading-tight">
                  {shown.name}
                </h2>
                <p className="mt-0.5 text-[14px] text-secondary">
                  {shown.type}
                  {shown.lifecycle_status === "harvested"
                    ? " · Harvested"
                    : ""}
                </p>
              </div>
              {/* exact score (or status icon when "New") */}
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-white"
                style={{ backgroundColor: display.color }}
                aria-label={
                  scoreText
                    ? `Health score ${scoreText}`
                    : `Status ${display.label}`
                }
              >
                {scoreText ?? display.icon}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge
                tone={
                  display.band === "healthy"
                    ? "brand"
                    : display.band === "attention"
                      ? "warning"
                      : display.band === "critical"
                        ? "critical"
                        : "neutral"
                }
              >
                {display.icon} {display.label}
              </Badge>
              <span className="text-[13px] text-secondary">
                Planted {shown.plant_date}
              </span>
            </div>

            {/* quick actions */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {QUICK.map((a) => (
                <button
                  key={a.type}
                  type="button"
                  onClick={() => setLogType(a.type)}
                  className="flex flex-col items-center gap-1.5 rounded-squarcle bg-fill py-3 active:opacity-80"
                >
                  <span className="text-[22px]">{a.icon}</span>
                  <span className="text-[12px] font-medium">{a.label}</span>
                </button>
              ))}
            </div>

            {/* primary CTA → full detail page */}
            <Button
              href={`/farms/${farmId}/plants/${shown.id}`}
              full
              className="mt-5"
            >
              View More Details
            </Button>
          </div>
        )}
      </BottomSheet>

      {shown && logType && (
        <LogModal
          plant={shown}
          type={logType}
          onClose={() => setLogType(null)}
          onLogged={(score) => onLogged(shown.id, score)}
        />
      )}
    </>
  );
}
