import { cn } from "@/lib/utils";

/** White card (06 §8): radius 20, soft shadow, 16px padding. */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-card bg-card p-4 shadow-card", className)}>
      {children}
    </div>
  );
}
