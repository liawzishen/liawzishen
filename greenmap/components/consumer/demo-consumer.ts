/**
 * Simulated consumer-side data for the buyer preview (Phase-3). Like the
 * marketplace listings and payments, this is seeded mock data so the consumer
 * experience can be shown without real orders, points ledgers or accounts.
 * No DB. In later phases these come from real orders / a GreenPoints ledger.
 */

export const CONSUMER = {
  greenPoints: 340,
  tier: "Green Member",
  // "Your impact" stats on the home dashboard
  impact: {
    harvestsVerified: 12,
    farmersSupported: 5,
    kgBought: 18,
  },
};

export type OrderStatus = "delivered" | "confirmed" | "pending";

export type ConsumerOrder = {
  id: string;
  item: string;
  farm: string;
  emoji: string;
  qty: string; // "2 kg"
  total: number; // RM
  date: string; // display
  status: OrderStatus;
};

export const ORDERS: ConsumerOrder[] = [
  {
    id: "GM-L1-02",
    item: "Organic Cherry Tomatoes",
    farm: "Ladang Hijau",
    emoji: "🍅",
    qty: "2 kg",
    total: 16,
    date: "Today",
    status: "confirmed",
  },
  {
    id: "GM-L4-01",
    item: "Fragrant Lemongrass",
    farm: "Dusun Farah",
    emoji: "🌿",
    qty: "1 bundle",
    total: 5,
    date: "Yesterday",
    status: "pending",
  },
  {
    id: "GM-L2-03",
    item: "Fresh Red Chili",
    farm: "Kebun Siti",
    emoji: "🌶️",
    qty: "3 kg",
    total: 36,
    date: "3 Jul",
    status: "delivered",
  },
  {
    id: "GM-L3-05",
    item: "Pak Choi Bundles",
    farm: "Green Valley",
    emoji: "🥬",
    qty: "4 bundles",
    total: 12,
    date: "28 Jun",
    status: "delivered",
  },
];

export type FavouriteFarm = {
  name: string;
  grower: string;
  location: string;
  emoji: string;
  verified: boolean;
};

export const FAVOURITES: FavouriteFarm[] = [
  { name: "Ladang Hijau", grower: "Ahmad", location: "Johor", emoji: "🍅", verified: true },
  { name: "Dusun Farah", grower: "Farah", location: "Selangor", emoji: "🌿", verified: true },
  { name: "Green Valley", grower: "Lim", location: "Selangor", emoji: "🥬", verified: false },
];

export const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  delivered: { label: "Delivered", tone: "#0DB074" },
  confirmed: { label: "Confirmed", tone: "#007aff" },
  pending: { label: "Awaiting farmer", tone: "#F59E0B" },
};
