/**
 * Password validation helpers.
 *
 * Kept as small pure functions (no React, no side effects) so they're easy to
 * read, easy to test, and reusable later (e.g. a future reset-password screen).
 */

export interface PasswordRule {
  /** Stable key for React lists. */
  id: string;
  /** Human-friendly text shown in the checklist. */
  label: string;
  /** Returns true when the password satisfies this rule. */
  test: (password: string) => boolean;
}

/** The five rules a new password must satisfy (in display order). */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A–Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a–z)",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "One number (0–9)",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "symbol",
    label: "One symbol (e.g. ! ? @ #)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

/** Which rule ids currently pass, as a quick lookup map. */
export function checkPassword(password: string): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const rule of PASSWORD_RULES) {
    results[rule.id] = rule.test(password);
  }
  return results;
}

/** How many rules pass (0–5). Handy for the strength meter. */
export function passwordScore(password: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

/** True only when every rule passes. */
export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export type PasswordStrength = "weak" | "fair" | "strong";

/** Coarse strength label derived from the score. */
export function passwordStrength(password: string): PasswordStrength {
  const score = passwordScore(password);
  if (score <= 2) return "weak";
  if (score <= 4) return "fair";
  return "strong";
}
