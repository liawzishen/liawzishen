"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type SelectProps = {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "children">;

/**
 * iOS-style select — matches the Input look (fill, radius 12, 48px).
 *
 * Same id/aria-describedby/aria-invalid contract as <Input>; see that file.
 *
 * One extra fix specific to selects: `appearance-none` strips the native
 * dropdown arrow, and nothing was drawn in its place, so the control looked
 * like a plain text field and gave no hint that it opened a menu. The
 * chevron below restores that affordance. It is aria-hidden and
 * pointer-events-none, so it is decoration only — the real <select>
 * underneath keeps every native keyboard and platform behaviour.
 */
export function Select({
  label,
  hint,
  error,
  className,
  id,
  required,
  children,
  ...selectProps
}: SelectProps) {
  const reactId = useId();
  const selectId = id ?? `select-${reactId}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label
        htmlFor={selectId}
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
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
      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full appearance-none rounded-input border-2 border-tertiary bg-fill pl-4 pr-10 text-[16px] text-label",
            "transition focus:border-[#5c3a21]",
            error && "border-critical-ink"
          )}
          {...selectProps}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tertiary"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
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
