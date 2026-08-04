"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Everything the browser will hand focus to via Tab. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Reusable bottom sheet (D10).
 *
 * A bottom-anchored panel that slides up over the current screen. Stays
 * mounted so it can animate both in and out; when closed it sits off-screen.
 * Backdrop tap or Escape closes it. CSS transitions collapse automatically
 * under `prefers-reduced-motion` (see globals.css).
 *
 * Rendered through a PORTAL to <body>: glass surfaces use backdrop-filter,
 * which makes any ancestor a containing block for `fixed` descendants — a
 * sheet declared inside a glass card would otherwise be trapped in that
 * card's box (backdrop covering only the card, panel floating mid-screen).
 *
 * ── Modal behaviour ──────────────────────────────────────────────────────
 * It declared role="dialog" aria-modal="true" but behaved like neither:
 *
 *  - Nothing trapped focus. Tab walked straight out of the panel and into
 *    the page behind it, leaving a keyboard user driving a UI they could no
 *    longer see while the sheet claimed to be modal.
 *  - Focus was never given back. On close it landed at the top of the
 *    document instead of the control that opened the sheet.
 *  - Because the sheet stays mounted when closed, `aria-hidden` hid it from
 *    screen readers but left every control inside it TABBABLE — the worst
 *    combination, a focus stop that reads as nothing. `inert` fixes both.
 *  - The page behind stayed in the accessibility tree and kept scrolling.
 *
 * All four are handled below.
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
  /** Required: a modal dialog must have an accessible name. */
  ariaLabel: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // Keep the latest onClose without making it an effect dependency — an
  // inline arrow from the parent changes identity every render, which would
  // otherwise re-run the effect and yank focus back on each keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    // Remember what to give focus back to, then move into the panel.
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const root = rootRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        // Nothing to land on — hold focus on the panel rather than let it
        // escape to the page behind.
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active instanceof Node && !root.contains(active)) {
        // Focus somehow sits outside the sheet (browser chrome, stray
        // programmatic focus) — pull it back in.
        e.preventDefault();
        first.focus();
      }
    };

    // Hide the rest of the page from AT and from the pointer while modal.
    const siblings = Array.from(document.body.children).filter(
      (el) => el !== rootRef.current && !el.contains(rootRef.current!)
    ) as HTMLElement[];
    const previouslyInert = siblings.map((el) => el.hasAttribute("inert"));
    siblings.forEach((el) => el.setAttribute("inert", ""));

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      siblings.forEach((el, i) => {
        if (!previouslyInert[i]) el.removeAttribute("inert");
      });
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  // SSR renders nothing; the sheet only ever opens client-side anyway.
  if (!mounted) return null;

  return createPortal(
    <div
      ref={rootRef}
      // `inert` removes the closed sheet from the a11y tree AND the tab
      // order together — aria-hidden alone left focusable orphans behind.
      inert={!open}
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* backdrop — dark + blurred so the page fully recedes behind the sheet */}
      <button
        type="button"
        aria-label="Close"
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
        <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-tertiary" />
        {children}
      </div>
    </div>,
    document.body
  );
}
