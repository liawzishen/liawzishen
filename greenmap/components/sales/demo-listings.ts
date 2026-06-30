/**
 * Shared mock marketplace data for the simulated sales preview. Used by both
 * the Marketplace cards and the listing detail so they stay in sync. No DB.
 */

export type Listing = {
  id: string;
  name: string;
  farm: string;
  grower: string;
  location: string;
  freshness: string;
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
};

export const LISTINGS: Listing[] = [
  {
    id: "l1",
    name: "Organic Cherry Tomatoes",
    farm: "Ladang Hijau",
    grower: "Ahmad",
    location: "Johor",
    freshness: "Harvested today",
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
  },
  {
    id: "l2",
    name: "Fresh Red Chili",
    farm: "Kebun Siti",
    grower: "Siti",
    location: "Selangor",
    freshness: "Harvested yesterday",
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
  },
  {
    id: "l3",
    name: "Pak Choi Bundles",
    farm: "Green Valley",
    grower: "Lim",
    location: "Selangor",
    freshness: "Harvested today",
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
  },
];

export function getListing(id: string): Listing | undefined {
  return LISTINGS.find((l) => l.id === id);
}
