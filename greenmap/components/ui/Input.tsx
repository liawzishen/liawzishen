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
        className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-[#5c3a21]"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "h-12 w-full rounded-input border-2 border-[#c29b68]/40 bg-[#e8d7b3]/25 px-4 text-[16px] text-label placeholder:text-secondary/60",
          "outline-none transition focus:border-[#8b5a2b] focus:bg-[#f6ecd5]",
          error && "border-critical/70"
        )}
        {...inputProps}
      />
      {error && <p className="mt-1 text-[13px] text-critical">{error}</p>}
    </div>
  );
}
