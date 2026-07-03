import { cn } from "@/lib/utils";

/** Glass card (Liquid Glass spec): radius 20, translucent blur panel, 16px padding. */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-card p-4 glass", className)}>{children}</div>
  );
}
