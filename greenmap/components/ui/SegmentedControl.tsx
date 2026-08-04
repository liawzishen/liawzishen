"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

/**
 * iOS segmented control (06 §8): fill track, raised selected pill.
 *
 * Implemented as an APG **radiogroup**, not a tablist. It previously
 * declared role="tablist"/role="tab" while implementing none of the Tabs
 * pattern — no arrow keys, no roving tabindex, no aria-controls, and no
 * tabpanel for the tabs to control. The roles promised a widget that wasn't
 * there. This control picks one value out of a set and shows no panel, so
 * radiogroup is what it actually is.
 *
 * The APG radiogroup contract, implemented in full:
 *  - the group is ONE tab stop; Tab enters and Tab leaves (roving tabindex);
 *  - Arrow keys move between options and select as they go, wrapping around;
 *  - Home/End jump to the first/last option;
 *  - focus follows selection, so the ring never strands on a stale option.
 *
 * Selection is also visible without colour: the chosen pill gains a solid
 * border (3.71:1 against the track — it was a white-on-#efe3c8 pill at
 * 1.27:1, effectively invisible) and its label goes semibold.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group — a radiogroup must have one. */
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectAt = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        selectAt(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        selectAt(index - 1);
        break;
      case "Home":
        e.preventDefault();
        selectAt(0);
        break;
      case "End":
        e.preventDefault();
        selectAt(options.length - 1);
        break;
    }
  };

  const selectedIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex rounded-full bg-fill p-1", className)}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: the group is a single tab stop. When nothing
            // matches yet, the first option holds it so the group stays
            // reachable at all.
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "pressable h-9 flex-1 rounded-full text-[15px] transition",
              selected
                ? "border border-[#8b6f42] bg-white font-semibold text-label shadow-sm"
                : "border border-transparent font-medium text-secondary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
