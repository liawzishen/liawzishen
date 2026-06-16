import { cn } from "@/lib/utils";

/** Centred empty state — guides toward the first action (06 §4). */
export function EmptyState({
  icon,
  title,
  body,
  className,
  children,
}: {
  icon?: string;
  title: string;
  body?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div aria-hidden className="mb-3 text-[44px] leading-none">
          {icon}
        </div>
      )}
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {body && (
        <p className="mt-1.5 max-w-[280px] text-[15px] leading-relaxed text-secondary">
          {body}
        </p>
      )}
      {children && <div className="mt-5 w-full max-w-[280px]">{children}</div>}
    </div>
  );
}
