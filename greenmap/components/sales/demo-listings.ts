/**
 * Shared mock marketplace data for the simulated sales preview. Used by both
 * the Marketplace cards and the listing detail so they stay in sync. No DB.
 *
 * The engagement fields (salesCount, impressions, clicks, medianDwellSeconds)
 * are SIMULATED — seeded here the way payments are simulated — so the ranking
 * engine (lib/marketplace/rank.ts) can be demonstrated without live traffic.
 * In Phase 3 they are filled from a real listing-events aggregation; the
 * ranker doesn't change.
 */

export type Listing = {
  id: string;
  name: string;
  farm: string;
  grower: string;
  location: string;
  freshness: string;
  /** Hours since harvest — drives the ranker's freshness decay. */
  harvestedHoursAgo: number;
  distanceKm: number;
  verified: boolean;
  badges: string[];
  price: number; // RM per unit
  unit: string; // "kg" | "bundle"
  gradient: string;
  emoji: string;
  plantedDate: string;
  harvestDate: string;
  avgHealth: number;
  // ── simulated engagement signals (see file header) ──
  salesCount: number; // completed orders → popularity
  impressions: number; // times shown in a list
  clicks: number; // times the card was tapped
  medianDwellSeconds: number; // median time on the detail page
};

export const LISTINGS: Listing[] = [
  {
    id: "l1",
    name: "Organic Cherry Tomatoes",
    farm: "Ladang Hijau",
    grower: "Ahmad",
    location: "Johor",
    freshness: "Harvested today",
    harvestedHoursAgo: 4,
    distanceKm: 15,
    verified: true,
    badges: ["Pesticide Free", "AI Verified", "Verified Grower"],
    price: 8,
    unit: "kg",
    gradient: "linear-gradient(135deg,#FF6B5B,#E24B4A)",
    emoji: "🍅",
    plantedDate: "12 Mar 2026",
    harvestDate: "20 Jun 2026",
    avgHealth: 87,
    salesCount: 120,
    impressions: 900,
    clicks: 140,
    medianDwellSeconds: 42,
  },
  {
    id: "l2",
    name: "Fresh Red Chili",
    farm: "Kebun Siti",
    grower: "Siti",
    location: "Selangor",
    freshness: "Harvested yesterday",
    harvestedHoursAgo: 20,
    distanceKm: 8,
    verified: true,
    badges: ["Pesticide Free"],
    price: 12,
    unit: "kg",
    gradient: "linear-gradient(135deg,#FF8A5B,#E2734A)",
    emoji: "🌶️",
    plantedDate: "2 Apr 2026",
    harvestDate: "19 Jun 2026",
    avgHealth: 81,
    salesCount: 60,
    impressions: 500,
    clicks: 55,
    medianDwellSeconds: 30,
  },
  {
    id: "l3",
    name: "Pak Choi Bundles",
    farm: "Green Valley",
    grower: "Lim",
    location: "Selangor",
    freshness: "Harvested today",
    harvestedHoursAgo: 3,
    distanceKm: 5,
    verified: false,
    badges: [],
    price: 3,
    unit: "bundle",
    gradient: "linear-gradient(135deg,#7FB069,#A7C957)",
    emoji: "🥬",
    plantedDate: "1 May 2026",
    harvestDate: "20 Jun 2026",
    avgHealth: 74,
    salesCount: 40,
    impressions: 700,
    clicks: 40,
    medianDwellSeconds: 22,
  },
  {
    id: "l4",
    name: "Fragrant Lemongrass",
    farm: "Dusun Farah",
    grower: "Farah",
    location: "Selangor",
    freshness: "Harvested today",
    harvestedHoursAgo: 2,
    distanceKm: 6,
    verified: true,
    badges: ["Pesticide Free", "Organic"],
    price: 5,
    unit: "bundle",
    gradient: "linear-gradient(135deg,#9CCC65,#7CB342)",
    emoji: "🌿",
    plantedDate: "20 Apr 2026",
    harvestDate: "21 Jun 2026",
    avgHealth: 90,
    // brand-new listing — no engagement history yet (cold start)
    salesCount: 0,
    impressions: 0,
    clicks: 0,
    medianDwellSeconds: 0,
  },
  {
    id: "l5",
    name: "Sweet Corn",
    farm: "Ladang Jaya",
    grower: "Kumar",
    location: "Perak",
    freshness: "Harvested 2 days ago",
    harvestedHoursAgo: 60,
    distanceKm: 22,
    verified: true,
    badges: ["AI Verified", "Verified Grower"],
    price: 4,
    unit: "kg",
    gradient: "linear-gradient(135deg,#FFD54F,#FBC02D)",
    emoji: "🌽",
    plantedDate: "5 Mar 2026",
    harvestDate: "18 Jun 2026",
    avgHealth: 78,
    // top seller by volume, but older stock, far, and low dwell
    salesCount: 200,
    impressions: 2000,
    clicks: 150,
    medianDwellSeconds: 18,
  },
];

export function getListing(id: string): Listing | undefined {
  return LISTINGS.find((l) => l.id === id);
}
