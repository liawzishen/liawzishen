import { cn } from "@/lib/utils";

type Tone = "brand" | "warning" | "critical" | "info" | "neutral";

/**
 * Tinted pill (06 §8): ~15% colour background, coloured text.
 * PREVIEW = warning.
 *
 * The label uses each hue's INK value, never the fill value. A badge is the
 * worst case for contrast — the 15% tint darkens the background beneath
 * small 12px text — and the old pairings measured 1.69:1 (warning),
 * 2.65:1 (critical) and 3.01:1 (info) against a 4.5:1 requirement. The ink
 * tokens are verified against this exact tint-over-surface composite.
 */
const toneClasses: Record<Tone, string> = {
  brand: "bg-brand/15 text-brand-dark",
  warning: "bg-warning/15 text-warning-ink",
  critical: "bg-critical/15 text-critical-ink",
  info: "bg-info/15 text-info-ink",
  neutral: "bg-fill text-secondary",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
