"use client";

import {
  PASSWORD_RULES,
  checkPassword,
  passwordScore,
  passwordStrength,
} from "@/lib/auth/password";
import { cn } from "@/lib/utils";

/**
 * Live feedback under the Register password field:
 *  - a 5-segment strength bar
 *  - a ✓ / ○ checklist, one row per rule
 *
 * Purely presentational — it reads the password and renders state.
 */
export function PasswordChecklist({ password }: { password: string }) {
  const results = checkPassword(password);
  const score = passwordScore(password);
  const strength = passwordStrength(password);

  const strengthLabel =
    password.length === 0
      ? ""
      : strength === "weak"
        ? "Weak"
        : strength === "fair"
          ? "Fair"
          : "Strong";

  const strengthColor =
    strength === "weak"
      ? "text-critical"
      : strength === "fair"
        ? "text-warning"
        : "text-brand";

  const segmentColor =
    strength === "weak"
      ? "bg-critical"
      : strength === "fair"
        ? "bg-warning"
        : "bg-brand";

  return (
    <div className="mt-2.5">
      {/* Strength bar: 5 segments fill as more rules pass */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {PASSWORD_RULES.map((rule, i) => (
            <span
              key={rule.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < score ? segmentColor : "bg-tertiary"
              )}
            />
          ))}
        </div>
        {strengthLabel && (
          <span className={cn("text-[12px] font-semibold", strengthColor)}>
            {strengthLabel}
          </span>
        )}
      </div>

      {/* Rule checklist */}
      <ul className="mt-2.5 space-y-1.5" aria-label="Password requirements">
        {PASSWORD_RULES.map((rule) => {
          const passed = results[rule.id];
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-2 text-[13px] transition-colors",
                passed ? "text-brand-dark" : "text-secondary"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  passed ? "bg-brand text-white" : "bg-fill text-tertiary"
                )}
              >
                {passed ? "✓" : ""}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
