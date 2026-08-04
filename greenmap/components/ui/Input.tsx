"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type InputProps = {
  label: string;
  /** Persistent helper text. Unlike a placeholder it survives typing. */
  hint?: string;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

/**
 * iOS-style input (06 §8): fill background, radius 12, 48px tall.
 *
 * Three accessibility properties, each fixing a real defect:
 *
 *  - the id comes from useId(), not from the label text. Deriving it meant
 *    two fields labelled the same on one page produced duplicate ids, and
 *    the second label then pointed at the first input.
 *  - `aria-invalid` + `aria-describedby` wire the hint and error message TO
 *    the field. Previously the error was a loose <p> beside the input:
 *    visible, but silent to exactly the people who most need it.
 *  - the resting border is solid `tertiary` (4.02:1 against the fill). It
 *    was #c29b68/40 — 1.28:1 — which left the field with no discernible
 *    edge at all.
 *
 * The global :focus-visible ring is deliberately NOT suppressed here. The
 * border and fill shift ride on top of it as a redundant cue, rather than
 * replacing it with a colour-only signal.
 */
export function Input({
  label,
  hint,
  error,
  className,
  id,
  required,
  ...inputProps
}: InputProps) {
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-[#5c3a21]"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-critical-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="mb-1.5 text-[13px] text-secondary">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-input border-2 border-tertiary bg-[#e8d7b3]/25 px-4 text-[16px] text-label placeholder:text-[#6b4423]/90",
          "transition focus:border-[#5c3a21] focus:bg-[#f6ecd5]",
          error && "border-critical-ink"
        )}
        {...inputProps}
      />
      {error && (
        <p
          id={errorId}
          className="mt-1 text-[13px] font-medium text-critical-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}
