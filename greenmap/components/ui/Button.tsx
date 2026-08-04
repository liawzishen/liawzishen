import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "fill" | "ghost";
type Size = "lg" | "sm";

const baseClasses =
  "pressable inline-flex items-center justify-center gap-2 font-rustic font-semibold disabled:pointer-events-none disabled:opacity-50";

/*
 * `primary` keeps its #f6ecd5 label: the brand gradient's light stop was
 * darkened to #4a722d in globals.css, which lifts that pairing from 3.47:1
 * to 4.79:1. `fill` uses a solid tertiary border because its background
 * (#f6ecd5/80) sits almost on top of the parchment page — the border IS the
 * button's boundary, so it has to carry the 3:1 non-text contrast itself.
 * `ghost` uses brand-DARK: plain brand measured 4.46:1 on glass surfaces,
 * just under the 4.5:1 floor, and ghost buttons often sit on glass.
 */
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-[#f6ecd5] wood-btn-shadow pressable-glow hover:brightness-105",
  fill: "border-2 border-tertiary bg-[#f6ecd5]/80 text-label backdrop-blur-md hover:bg-[#f6ecd5]",
  ghost: "bg-transparent text-brand-dark active:opacity-60",
};

const sizeClasses: Record<Size, string> = {
  lg: "h-[50px] rounded-btn px-5 text-[17px]", // 50px tall, radius 14
  sm: "h-9 rounded-btn px-4 text-[15px]", // small inline
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  /** When set, renders a <Link> styled as a button. */
  href?: string;
  /**
   * In-flight state. Sets aria-busy and blocks re-entry, so a slow save
   * can't be fired twice. Pair it with a label change ("Saving…") — busy
   * must never be signalled by a spinner alone.
   */
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children"
>;

export function Button({
  variant = "primary",
  size = "lg",
  full,
  href,
  busy,
  className,
  children,
  type,
  disabled,
  ...buttonProps
}: ButtonProps) {
  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    full && "w-full",
    className
  );

  const isDisabled = disabled || busy;

  /*
   * A disabled link is a contradiction — <a> has no disabled state, and
   * `pointer-events: none` still leaves it in the tab order and clickable
   * by keyboard. So when an href-button is disabled we render a real
   * disabled <button>: inert, correctly announced, out of the tab order.
   */
  if (href && !isDisabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      // Bare <button> defaults to type="submit", so any button inside a
      // <form> submitted it — including "Cancel" and toggle rows.
      type={type ?? "button"}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      className={classes}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
