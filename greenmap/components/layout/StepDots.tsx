import { cn } from "@/lib/utils";

/** Wizard progress (Steps 1–3 of farm setup). */
export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-3"
      aria-label={`Step ${step} of 3`}
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 rounded-full transition-all",
            n === step ? "w-6 bg-brand" : "w-2 bg-tertiary"
          )}
        />
      ))}
    </div>
  );
}
