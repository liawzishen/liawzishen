"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable bottom sheet (D10).
 *
 * A bottom-anchored panel that slides up over the current screen. Stays
 * mounted so it can animate both in and out; when closed it sits off-screen
 * with pointer events disabled. Backdrop tap or Escape closes it. The CSS
 * transitions automatically collapse under `prefers-reduced-motion` (see
 * globals.css). Purely presentational — pass any content as children.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  ariaLabel,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the sheet for keyboard + screen-reader users.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50 backdrop-blur-md"
      />

      {/* sheet panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-[430px] rounded-t-[26px] glass-sheet px-6 pb-8 pt-3 outline-none",
          "transition-transform duration-300 will-change-transform",
          open ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        {/* grab handle */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-tertiary" />
        {children}
      </div>
    </div>
  );
}
