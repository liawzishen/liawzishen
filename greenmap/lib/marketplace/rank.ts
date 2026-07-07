/**
 * Marketplace ranking engine.
 *
 * Decides the order buyers see listings in. Two layers, the way real
 * marketplaces (Shopee / Lazada / Amazon) do it:
 *
 *   1. A capped PROMOTED tier — paid boosts get the top slot(s), but only a
 *      few, and only if the listing is actually relevant (in stock, not
 *      expired, matches the active filter). Paid visibility must not turn the
 *      board into a wall of ads, or buyers stop trusting it.
 *   2. An ORGANIC tier ordered by a weighted relevance score blending
 *      popularity, engagement, freshness, trust, proximity and health.
 *
 * The score is a pure function of the signals passed in. In the MVP those
 * signals are SIMULATED (seeded on the demo listings, like the simulated
 * payments) so the algorithm can be demonstrated without live traffic. In
 * Phase 3 the same fields are filled from a real `listing_events`
 * aggregation — the ranker itself doesn't change.
 */

/** The signals the ranker needs from a listing. Structurally typed so it is
 *  decoupled from the full Listing shape. */
export interface Rankable {
  id: string;
  /** Completed orders — the "wisdom of crowds" popularity signal. */
  salesCount: number;
  /** Times this card has been shown in a list (denominator for CTR). */
  impressions: number;
  /** Times the card was tapped (numerator for CTR). */
  clicks: number;
  /** Median seconds a shopper spends on the listing detail page. */
  medianDwellSeconds: number;
  /** When it was harvested (ISO) — drives perishable freshness decay. */
  harvestedAt: string;
  /** Distance from the buyer, km. Location-first marketplace principle. */
  distanceKm: number;
  /** Passport-verified grower (the trust moat). */
  verified: boolean;
  /** Trust badges (Pesticide Free, Organic, AI Verified, Verified Grower). */
  badges: string[];
  /** Passport average plant health, 0–100. */
  avgHealth: number;
  /** False once sold out — excluded from the promoted top slots. */
  inStock?: boolean;
  /** Optional auto-expiry (ISO); past this the listing can't be promoted. */
  expiresAt?: string;
}

export type RankReason =
  | "promoted"
  | "popular"
  | "trending"
  | "fresh"
  | "nearby"
  | "verified"
  | "new";

export interface Ranked<T extends Rankable> {
  listing: T;
  /** 0–100 organic relevance score (before the promoted tier is applied). */
  score: number;
  promoted: boolean;
  /** The single strongest reason this listing ranks where it does. */
  reason: RankReason;
}

export interface RankContext {
  /** Listing ids with a live paid boost. */
  boostedIds?: Iterable<string>;
  /** "Now" for freshness/expiry maths — injectable for tests. */
  now?: Date;
  /** Max promoted cards shown at the top (anti ad-flood). Default 2. */
  maxPromoted?: number;
}

/* ── signal weights (sum to 1.0) ──────────────────────────────────────────
   Popularity leads the organic blend, then engagement — the buyer's stated
   priorities. Freshness, trust, proximity and health are produce-specific
   shapers that keep pay-to-win from burying good local listings. */
const W = {
  popularity: 0.3,
  engagement: 0.22,
  freshness: 0.18,
  trust: 0.15,
  proximity: 0.1,
  health: 0.05,
} as const;

/** Freshness half-life-ish constant (hours). ~1.0 today, ~0.4 at 2 days. */
const FRESH_TAU_HOURS = 48;
/** Distance decay constant (km). 1.0 at 0km, ~0.37 at 15km. */
const DISTANCE_D0_KM = 15;
/** Dwell is capped so one stuck tab can't dominate. */
const DWELL_CAP_SECONDS = 60;
/** Bayesian CTR smoothing strength, in "prior impressions". A listing with
 *  few impressions is pulled toward the marketplace-average CTR, so new
 *  growers aren't buried by a cold start (explore/exploit fairness). */
const CTR_PRIOR_STRENGTH = 20;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function hoursBetween(fromISO: string, now: Date): number {
  const t = new Date(fromISO).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - t) / 3_600_000);
}

/**
 * Score one listing 0–100 against the set-wide context (max sales for log
 * normalisation, the average CTR prior). Pure; no ordering here.
 */
function organicScore(
  l: Rankable,
  ctx: { maxSales: number; priorCtr: number; now: Date }
): { score: number; parts: Record<keyof typeof W, number> } {
  // Popularity — log-damped so a single bestseller can't monopolise #1.
  const popularity =
    ctx.maxSales <= 0
      ? 0
      : Math.log1p(Math.max(0, l.salesCount)) / Math.log1p(ctx.maxSales);

  // Engagement — clicks (Bayesian-smoothed CTR) blended with dwell time.
  const ctr =
    (l.clicks + CTR_PRIOR_STRENGTH * ctx.priorCtr) /
    (l.impressions + CTR_PRIOR_STRENGTH);
  const ctrScore = clamp01(ctr / Math.max(ctx.priorCtr * 3, 0.0001));
  const dwellScore = clamp01(l.medianDwellSeconds / DWELL_CAP_SECONDS);
  const engagement = 0.5 * ctrScore + 0.5 * dwellScore;

  // Freshness — exponential decay on hours since harvest (perishable).
  const freshness = Math.exp(-hoursBetween(l.harvestedAt, ctx.now) / FRESH_TAU_HOURS);

  // Trust — passport verification + up to three badges. The moat.
  const trust = 0.5 * (l.verified ? 1 : 0) + 0.5 * (Math.min(l.badges.length, 3) / 3);

  // Proximity — closer is better (location-first).
  const proximity = Math.exp(-Math.max(0, l.distanceKm) / DISTANCE_D0_KM);

  // Health — passport average plant health.
  const health = clamp01(l.avgHealth / 100);

  const parts = { popularity, engagement, freshness, trust, proximity, health };
  const score =
    100 *
    (W.popularity * popularity +
      W.engagement * engagement +
      W.freshness * freshness +
      W.trust * trust +
      W.proximity * proximity +
      W.health * health);

  return { score, parts };
}

const SIGNAL_REASON: Record<keyof typeof W, RankReason> = {
  popularity: "popular",
  engagement: "trending",
  freshness: "fresh",
  trust: "verified",
  proximity: "nearby",
  health: "verified",
};

/**
 * The chip explains what makes THIS listing stand out — the signal on which it
 * most over-indexes versus the rest of the set (largest positive deviation
 * from the set mean), not just its highest raw signal (which would label
 * everything "popular"). Ties break toward the more important weight.
 */
function reasonFor(
  parts: Record<keyof typeof W, number>,
  means: Record<keyof typeof W, number>,
  isNew: boolean
): RankReason {
  if (isNew) return "new";
  const keys = Object.keys(W) as (keyof typeof W)[];
  const ranked = keys
    .map((k) => ({ k, edge: parts[k] - means[k], weight: W[k] }))
    .sort((a, b) => b.edge - a.edge || b.weight - a.weight);
  return SIGNAL_REASON[ranked[0].k];
}

function isRelevantForPromotion(l: Rankable, now: Date): boolean {
  if (l.inStock === false) return false;
  if (l.expiresAt && new Date(l.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Rank a list of already-filtered listings. Returns a new array (input is not
 * mutated) ordered promoted-first (capped), then organic by descending score.
 */
export function rankListings<T extends Rankable>(
  listings: T[],
  ctx: RankContext = {}
): Ranked<T>[] {
  const now = ctx.now ?? new Date();
  const boosted = new Set(ctx.boostedIds ?? []);
  const maxPromoted = ctx.maxPromoted ?? 2;

  if (listings.length === 0) return [];

  // Set-wide context for normalisation.
  const maxSales = Math.max(0, ...listings.map((l) => l.salesCount));
  const totalClicks = listings.reduce((s, l) => s + l.clicks, 0);
  const totalImpr = listings.reduce((s, l) => s + l.impressions, 0);
  const priorCtr = totalImpr > 0 ? totalClicks / totalImpr : 0.05;

  const withParts = listings.map((listing) => ({
    listing,
    ...organicScore(listing, { maxSales, priorCtr, now }),
    // "New" = no engagement history yet; flag it so it reads as fresh-to-market
    // rather than unpopular (it already got the CTR prior above).
    isNew: listing.impressions === 0 && listing.salesCount === 0,
  }));

  // Per-signal set means, so each card's chip highlights what it over-indexes on.
  const keys = Object.keys(W) as (keyof typeof W)[];
  const means = {} as Record<keyof typeof W, number>;
  for (const k of keys) {
    means[k] = withParts.reduce((s, w) => s + w.parts[k], 0) / withParts.length;
  }

  const scored: Ranked<T>[] = withParts.map((w) => ({
    listing: w.listing,
    score: w.score,
    promoted: false,
    reason: reasonFor(w.parts, means, w.isNew),
  }));

  // Promoted tier: boosted + relevant, best-scoring first, capped. Overflow
  // stays in the organic pool (the paid perk is the top slot + the label, not
  // unlimited dominance).
  const promotedPool = scored
    .filter((s) => boosted.has(s.listing.id) && isRelevantForPromotion(s.listing, now))
    .sort((a, b) => b.score - a.score);
  const promoted = promotedPool.slice(0, maxPromoted).map((s) => ({
    ...s,
    promoted: true,
    reason: "promoted" as RankReason,
  }));
  const promotedIds = new Set(promoted.map((s) => s.listing.id));

  // Organic tier: everything not in the promoted slots, by score desc, with a
  // deterministic freshness→id tie-break so order is stable.
  const organic = scored
    .filter((s) => !promotedIds.has(s.listing.id))
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.listing.harvestedAt).getTime() -
          new Date(a.listing.harvestedAt).getTime() ||
        (a.listing.id < b.listing.id ? -1 : 1)
    );

  return [...promoted, ...organic];
}
