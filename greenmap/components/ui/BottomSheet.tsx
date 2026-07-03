"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Reusable bottom sheet (D10).
 *
 * A bottom-anchored panel that slides up over the current screen. Stays
 * mounted so it can animate both in and out; when closed it sits off-screen
 * with pointer events disabled. Backdrop tap or Escape closes it. The CSS
 * transitions automatically collapse under `prefers-reduced-motion` (see
 * globals.css). Purely presentational — pass any content as children.
 *
 * Rendered through a PORTAL to <body>: glass surfaces use backdrop-filter,
 * which makes any ancestor a containing block for `fixed` descendants — a
 * sheet declared inside a glass card would otherwise be trapped in that
 * card's box (backdrop covering only the card, panel floating mid-screen).
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  // SSR renders nothing; the sheet only ever opens client-side anyway.
  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* backdrop — dark + blurred so the page fully recedes behind the sheet */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-md"
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
    </div>,
    document.body
  );
}
