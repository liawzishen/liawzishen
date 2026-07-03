import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "fill" | "ghost";
type Size = "lg" | "sm";

const baseClasses =
  "inline-flex items-center justify-center font-semibold transition active:opacity-80 disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-white shadow-[0_6px_16px_rgb(52_199_89/0.35)] active:scale-[0.97]",
  fill: "border border-white/60 bg-white/60 text-label backdrop-blur-md active:scale-[0.98]",
  ghost: "bg-transparent text-brand",
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
  className,
  children,
  ...buttonProps
}: ButtonProps) {
  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    full && "w-full",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
