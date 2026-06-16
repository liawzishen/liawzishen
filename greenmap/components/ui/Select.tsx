import { cn } from "@/lib/utils";

type SelectProps = {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "children">;

/** iOS-style select — matches the Input look (fill, radius 12, 48px). */
export function Select({
  label,
  error,
  className,
  id,
  children,
  ...selectProps
}: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={className}>
      <label
        htmlFor={selectId}
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
      >
        {label}
      </label>
      <select
        id={selectId}
        className={cn(
          "h-12 w-full appearance-none rounded-input bg-fill px-4 text-[16px] text-label",
          "focus:outline-none focus:ring-2 focus:ring-brand/50",
          error && "ring-2 ring-critical/60"
        )}
        {...selectProps}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-[13px] text-critical">{error}</p>}
    </div>
  );
}
