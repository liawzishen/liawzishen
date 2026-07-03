import { cn } from "@/lib/utils";

type InputProps = {
  label: string;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

/** iOS-style input (06 §8): fill background, no border, radius 12, 48px tall. */
export function Input({ label, error, className, id, ...inputProps }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-secondary"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "h-12 w-full rounded-input border border-white/60 bg-white/70 px-4 text-[16px] text-label placeholder:text-secondary",
          "focus:outline-none focus:ring-2 focus:ring-brand/50",
          error && "ring-2 ring-critical/60"
        )}
        {...inputProps}
      />
      {error && <p className="mt-1 text-[13px] text-critical">{error}</p>}
    </div>
  );
}
