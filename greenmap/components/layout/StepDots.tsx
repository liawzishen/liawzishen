import { cn } from "@/lib/utils";

/** Wizard progress (Steps 1–3 of farm setup). */
export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {/*
        `aria-label` on a plain <div> (no role) is dropped by screen readers,
        so this progress used to announce nothing at all — the step was pure
        colour. Real text carries it instead; `sr-only` is position:absolute,
        so it stays out of flow and the dots don't shift or gain a gap.
      */}
      <span className="sr-only">{`Step ${step} of 3`}</span>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          aria-current={n === step ? "step" : undefined}
          className={cn(
            "h-2 rounded-full transition-all",
            n === step ? "w-6 bg-brand" : "w-2 bg-tertiary"
          )}
        />
      ))}
    </div>
  );
}
