/**
 * Billing constants — the single source of truth for tiers and prices.
 * Server routes derive every charge from here; clients NEVER send amounts.
 * Business rules: AI Scan tiers §1, payment §6, promoted listings §7 of the
 * confirmed business model (see the 2026-07-03 payments spec).
 */

export type PlanId = "percuma" | "asas" | "pro" | "unlimited";

export type PlanDef = {
  id: PlanId;
  /** Malay-first display name (locked in the business model). */
  name: string;
  /** Short English descriptor shown under the name. */
  tagline: string;
  /** AI scans per calendar month; null = unlimited. */
  scansPerMonth: number | null;
  priceRM: number;
};

export const PLANS: Record<PlanId, PlanDef> = {
  percuma: {
    id: "percuma",
    name: "Percuma",
    tagline: "Free starter",
    scansPerMonth: 5,
    priceRM: 0,
  },
  asas: {
    id: "asas",
    name: "Asas",
    tagline: "Small farm basics",
    scansPerMonth: 20,
    priceRM: 6.9,
  },
  pro: {
    id: "pro",
    name: "Petani Pro",
    tagline: "Active farmer",
    scansPerMonth: 60,
    priceRM: 19.9,
  },
  unlimited: {
    id: "unlimited",
    name: "Tanpa Had",
    tagline: "Unlimited scanning",
    scansPerMonth: null,
    priceRM: 39.9,
  },
};

/** Cheapest → priciest; used to tell upgrades (charged) from downgrades (free). */
export const PLAN_ORDER: PlanId[] = ["percuma", "asas", "pro", "unlimited"];

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

/** Top-up: extra scans without a subscription (no expiry). */
export const TOPUP_PRICE_RM = 1.5;
export const TOPUP_MAX_QTY = 10;

export type BoostPackageId = "3d" | "7d" | "14d";

export type BoostPackage = {
  id: BoostPackageId;
  days: number;
  priceRM: number;
  label: string;
};

export const BOOST_PACKAGES: Record<BoostPackageId, BoostPackage> = {
  "3d": { id: "3d", days: 3, priceRM: 5, label: "3 days" },
  "7d": { id: "7d", days: 7, priceRM: 10, label: "7 days" },
  "14d": { id: "14d", days: 14, priceRM: 15, label: "14 days" },
};

export function isBoostPackageId(v: unknown): v is BoostPackageId {
  return typeof v === "string" && v in BOOST_PACKAGES;
}

export function formatRM(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}
