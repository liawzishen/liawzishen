"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Group,
  Image as KonvaImage,
  Circle,
  Text,
} from "react-konva";
import type Konva from "konva";
import { PlantMarker } from "./PlantMarker";
import { healthDisplay } from "@/lib/health/display";
import type { Farm, FarmPanorama, Plant } from "@/types/database";

interface Props {
  farm: Farm;
  plants: Plant[];
  placing: boolean;
  onPlace: (pos: { x: number; y: number }) => void;
  onMarkerClick: (plant: Plant) => void;
  /** Tapping empty space (not a marker) — used to clear selection. */
  onBackgroundClick?: () => void;
  /** Marker ids to highlight (e.g. "Need Care" filter); others dim. */
  highlightIds?: string[] | null;
  selectedId?: string | null;
  /** 360° capture spots (floor-plan view of the tour). Hidden while placing. */
  panoramas?: FarmPanorama[];
  onPanoramaClick?: (pano: FarmPanorama) => void;
}

/**
 * Bird's-eye farm canvas. Stored plant positions are 0–1 fractions of the
 * farm's canvas_width/height; converted to pixels for rendering and back to
 * fractions when placing a new plant. Client-only (Konva needs a real canvas).
 */
export function FarmMapCanvas({
  farm,
  plants,
  placing,
  onPlace,
  onMarkerClick,
  onBackgroundClick,
  highlightIds,
  selectedId,
  panoramas,
  onPanoramaClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const CANVAS_W = farm.canvas_width;
  const CANVAS_H = farm.canvas_height;

  // "Cover" fit: scale so the canvas FILLS the card (no white bands), centred.
  // Using max() instead of min() means the larger axis overflows and is
  // cropped by the container's overflow-hidden, leaving zero blank space.
  function fitToScreen(w: number, h: number) {
    if (!w || !h) return;
    const s = Math.max(w / CANVAS_W, h / CANVAS_H);
    setScale(s);
    setPos({ x: (w - CANVAS_W * s) / 2, y: (h - CANVAS_H * s) / 2 });
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize({ width: w, height: h });
      fitToScreen(w, h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CANVAS_W, CANVAS_H]);

  useEffect(() => {
    if (
      farm.background_url &&
      (farm.background_type === "upload" ||
        farm.background_type === "satellite")
    ) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = farm.background_url;
      img.onload = () => setBgImage(img);
    } else {
      setBgImage(null);
    }
  }, [farm.background_type, farm.background_url]);

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const mousePoint = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    // Never allow zooming out below the cover scale (would expose white).
    const coverScale = Math.max(size.width / CANVAS_W, size.height / CANVAS_H);
    const newScale = Math.max(
      coverScale,
      Math.min(4, oldScale * (direction > 0 ? 1.1 : 1 / 1.1))
    );
    setScale(newScale);
    setPos(
      clampPosition(
        pointer.x - mousePoint.x * newScale,
        pointer.y - mousePoint.y * newScale,
        newScale
      )
    );
  }

  function zoomBy(factor: number) {
    const w = size.width;
    const h = size.height;
    const oldScale = scale;
    const coverScale = Math.max(w / CANVAS_W, h / CANVAS_H);
    const newScale = Math.max(coverScale, Math.min(4, oldScale * factor));
    // keep the view centre stable while zooming with buttons
    const cx = (w / 2 - pos.x) / oldScale;
    const cy = (h / 2 - pos.y) / oldScale;
    setScale(newScale);
    setPos(clampPosition(w / 2 - cx * newScale, h / 2 - cy * newScale, newScale));
  }

  /**
   * Clamp a proposed {x,y} stage position so the (scaled) canvas always
   * covers the whole card — i.e. panning can never reveal white space.
   * If the canvas is smaller than the card on an axis (shouldn't happen with
   * cover-fit, but guard anyway), it stays centred on that axis.
   */
  function clampPosition(x: number, y: number, s: number) {
    const w = size.width;
    const h = size.height;
    const scaledW = CANVAS_W * s;
    const scaledH = CANVAS_H * s;

    let nx = x;
    let ny = y;

    if (scaledW >= w) {
      nx = Math.min(0, Math.max(w - scaledW, x)); // keep edges outside the card
    } else {
      nx = (w - scaledW) / 2;
    }
    if (scaledH >= h) {
      ny = Math.min(0, Math.max(h - scaledH, y));
    } else {
      ny = (h - scaledH) / 2;
    }
    return { x: nx, y: ny };
  }

  // Stage taps. In placing mode, ANY tap drops a plant at that pointer
  // position (simple and reliable). Otherwise, a tap on empty background
  // (target === the stage itself) clears the current selection; taps that
  // land on a marker are handled by the marker and ignored here.
  function handleStageClick(e: Konva.KonvaEventObject<Event>) {
    const stage = stageRef.current;
    if (placing) {
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const fx = (pointer.x - pos.x) / scale / CANVAS_W;
      const fy = (pointer.y - pos.y) / scale / CANVAS_H;
      onPlace({
        x: Math.min(1, Math.max(0, fx)),
        y: Math.min(1, Math.max(0, fy)),
      });
      return;
    }
    if (e.target === stage) onBackgroundClick?.();
  }

  // soil-row stripes for the smart background (organic feel)
  const soilRows = [];
  if (!bgImage) {
    const rows = 6;
    const gap = CANVAS_H / rows;
    for (let i = 0; i < rows; i++) {
      soilRows.push(
        <Rect
          key={`soil-${i}`}
          x={0}
          y={i * gap + gap * 0.32}
          width={CANVAS_W}
          height={gap * 0.36}
          fill="#C8B693"
          opacity={0.18}
          cornerRadius={8}
        />
      );
    }
  }

  // Mount Konva only once the container has real pixel dimensions. Rendering
  // the Stage at 0×0 makes its internal buffer canvas 0-sized; drawing a
  // shadowed shape then calls drawImage() on that empty canvas and throws
  // "InvalidStateError: ... width or height of 0" (seen on first paint and
  // when navigating to a plant's detail page). Guarding here prevents it.
  const ready = size.width > 0 && size.height > 0;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/*
        Keyboard / assistive-tech twin of the canvas.

        Konva paints markers into a <canvas>. They have no DOM node, so they
        cannot be focused, named or activated by keyboard — every plant on
        the map was unreachable without a pointer. The canvas itself cannot
        be fixed (you cannot tab "into" a bitmap), so the accessible route
        is a parallel list of real buttons that call exactly the same
        handlers the shapes do.

        It is sr-only until focus enters, then it becomes a visible panel —
        a purely sr-only list would send a sighted keyboard user's focus
        somewhere they cannot see. Same pattern as the 360 tour.
      */}
      <div className="sr-only z-20 focus-within:not-sr-only focus-within:absolute focus-within:inset-x-2 focus-within:bottom-2 focus-within:max-h-[55%] focus-within:overflow-auto focus-within:rounded-card focus-within:p-2 focus-within:glass-strong">
        <ul aria-label={`Plants on the ${farm.name} map`}>
          {plants.map((plant) => {
            const health = healthDisplay(plant.health_score);
            return (
              <li key={plant.id}>
                <button
                  type="button"
                  onClick={() => onMarkerClick(plant)}
                  aria-current={selectedId === plant.id ? "true" : undefined}
                  className="w-full rounded-input px-2 py-1.5 text-left text-[14px] focus-visible:bg-fill"
                >
                  {plant.name} — {health.label}
                  {highlightIds?.includes(plant.id) ? " (needs care)" : ""}
                </button>
              </li>
            );
          })}
        </ul>
        {(panoramas ?? []).length > 0 && onPanoramaClick && (
          <ul aria-label="360° photo spots on this map">
            {(panoramas ?? []).map((pano, i) => (
              <li key={pano.id}>
                <button
                  type="button"
                  onClick={() => onPanoramaClick(pano)}
                  className="w-full rounded-input px-2 py-1.5 text-left text-[14px] focus-visible:bg-fill"
                >
                  Open 360° photo spot {i + 1}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ready && (
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={!placing}
        dragBoundFunc={(p) => clampPosition(p.x, p.y, scale)}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDragEnd={(e) =>
          setPos(clampPosition(e.target.x(), e.target.y(), scale))
        }
      >
        {/* Background */}
        <Layer listening={false}>
          {bgImage ? (
            <KonvaImage image={bgImage} width={CANVAS_W} height={CANVAS_H} />
          ) : (
            <Group>
              <Rect
                width={CANVAS_W}
                height={CANVAS_H}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: CANVAS_W, y: CANVAS_H }}
                fillLinearGradientColorStops={[0, "#DFF5E1", 1, "#C9EAD0"]}
              />
              {soilRows}
            </Group>
          )}
        </Layer>

        {/* Markers */}
        <Layer>
          {!placing &&
            (panoramas ?? []).map((pano) => (
              <Group
                key={pano.id}
                x={pano.position_x * CANVAS_W}
                y={pano.position_y * CANVAS_H}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onPanoramaClick?.(pano);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onPanoramaClick?.(pano);
                }}
              >
                <Circle
                  radius={16}
                  fill="#ffffff"
                  opacity={0.92}
                  shadowBlur={6}
                  shadowOpacity={0.25}
                />
                <Circle radius={16} stroke="#4E7FA8" strokeWidth={2} />
                <Text
                  text="360°"
                  fontSize={9}
                  fontStyle="bold"
                  fill="#2B5C82"
                  width={32}
                  align="center"
                  offsetX={16}
                  offsetY={4.5}
                />
              </Group>
            ))}
          {plants.map((plant) => (
            <PlantMarker
              key={plant.id}
              plant={plant}
              x={plant.position_x * CANVAS_W}
              y={plant.position_y * CANVAS_H}
              selected={selectedId === plant.id}
              dimmed={
                highlightIds ? !highlightIds.includes(plant.id) : false
              }
              onClick={onMarkerClick}
            />
          ))}
        </Layer>
      </Stage>
      )}

      {/* Zoom controls — grouped into a styled pill, bottom-right */}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-full bg-white/95 shadow-card">
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center text-[20px] font-semibold text-label active:bg-fill"
        >
          +
        </button>
        <span className="mx-auto h-px w-5 bg-tertiary" />
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center text-[20px] font-semibold text-label active:bg-fill"
        >
          −
        </button>
        <span className="mx-auto h-px w-5 bg-tertiary" />
        <button
          type="button"
          onClick={() => fitToScreen(size.width, size.height)}
          aria-label="Fit to screen"
          className="flex h-9 w-9 items-center justify-center text-[14px] text-label active:bg-fill"
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
