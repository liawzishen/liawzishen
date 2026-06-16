"use client";

import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

/** iOS segmented control (06 §8): fill track, white selected pill with shadow. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-full bg-fill p-1", className)} role="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 flex-1 rounded-full text-[15px] font-medium transition",
              selected ? "bg-white text-label shadow-sm" : "text-secondary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
