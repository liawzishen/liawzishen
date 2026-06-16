import { cn } from "@/lib/utils";

type Tone = "brand" | "warning" | "critical" | "info" | "neutral";

/** Tinted pill (06 §8): ~15% colour background, coloured text. PREVIEW = warning. */
const toneClasses: Record<Tone, string> = {
  brand: "bg-brand/15 text-brand-dark",
  warning: "bg-warning/15 text-warning",
  critical: "bg-critical/15 text-critical",
  info: "bg-info/15 text-info",
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
