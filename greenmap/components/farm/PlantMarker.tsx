"use client";

import { Group, Circle, Text, Rect, Line } from "react-konva";
import { healthDisplay, type HealthBand } from "@/lib/health/display";
import type { Plant } from "@/types/database";

const RADIUS = 24;

/**
 * Plant marker — dashboard-node style.
 *
 * A solid band-colour circle with a white ring and the exact health % inside.
 * On selection it grows a soft glow and reveals a dark "Name | X% Health"
 * label pill with an upward pointer (matching the dashboard mockup). Labels
 * are shown for the selected marker only so the map stays readable with many
 * plants. A single tap selects → opens the bottom sheet (handled upstream).
 *
 * Marker colours use the dashboard palette (a touch more saturated than the
 * iOS band colours in display.ts, which still drive the plant detail page).
 */
const NODE_COLOR: Record<HealthBand, string> = {
  healthy: "#0DB074",
  attention: "#F59E0B",
  critical: "#EF4444",
  new: "#C7C7CC",
};

export function PlantMarker({
  plant,
  x,
  y,
  selected,
  dimmed,
  onClick,
}: {
  plant: Plant;
  x: number;
  y: number;
  selected?: boolean;
  dimmed?: boolean;
  onClick: (plant: Plant) => void;
}) {
  const band = healthDisplay(plant.health_score).band;
  const color = NODE_COLOR[band];
  const isNew = plant.health_score === null;
  const pct = isNew ? "New" : `${plant.health_score}%`;

  const pillText = `${plant.name} | ${isNew ? "New" : `${plant.health_score}% Health`}`;
  const pillW = Math.max(64, Math.round(pillText.length * 6.2) + 16);
  const pillH = 20;
  const pillTop = RADIUS + 9;

  return (
    <Group
      x={x}
      y={y}
      opacity={dimmed ? 0.35 : 1}
      onClick={() => onClick(plant)}
      onTap={() => onClick(plant)}
      onMouseEnter={(e) => {
        const s = e.target.getStage();
        if (s) s.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const s = e.target.getStage();
        if (s) s.container().style.cursor = "default";
      }}
    >
      {/* selected glow */}
      {selected && <Circle radius={RADIUS + 6} fill={color} opacity={0.25} />}

      {/* coloured circle with white ring */}
      <Circle
        radius={RADIUS}
        fill={color}
        stroke="#ffffff"
        strokeWidth={3}
        shadowBlur={6}
        shadowColor="#000000"
        shadowOpacity={0.2}
        shadowOffsetY={1}
      />

      {/* exact % inside (white, bold) */}
      <Text
        text={pct}
        width={RADIUS * 2}
        height={RADIUS * 2}
        offsetX={RADIUS}
        offsetY={RADIUS}
        align="center"
        verticalAlign="middle"
        fontSize={isNew ? 11 : 14}
        fontStyle="bold"
        fill="#ffffff"
        listening={false}
      />

      {/* label pill — selected marker only */}
      {selected && (
        <>
          <Line
            points={[-6, pillTop, 6, pillTop, 0, pillTop - 6]}
            closed
            fill="#1E434A"
            listening={false}
          />
          <Rect
            x={-pillW / 2}
            y={pillTop}
            width={pillW}
            height={pillH}
            cornerRadius={6}
            fill="#1E434A"
            shadowBlur={6}
            shadowColor="#000000"
            shadowOpacity={0.25}
            listening={false}
          />
          <Text
            text={pillText}
            x={-pillW / 2}
            y={pillTop}
            width={pillW}
            height={pillH}
            align="center"
            verticalAlign="middle"
            fontSize={11}
            fontStyle="bold"
            fill="#ffffff"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}

export const MARKER_RADIUS = RADIUS;
