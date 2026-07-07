/**
 * Database types — mirror of the SQL schema in supabase/migrations/.
 * Source of truth: docs/03_BACKEND_TRUTH.md.
 *
 * Hand-written (not generated) so they stay readable. If you change a
 * migration, update the matching type here.
 */

/* ── Shared enums / unions ──────────────────────────────────────────────── */

export type Role = "grower" | "consumer";
export type FarmSize = "small" | "medium" | "large";
export type BackgroundType = "smart" | "upload" | "satellite";

export type ManualStatus = "healthy" | "attention" | "critical";
export type LifecycleStatus = "active" | "harvested";

/** The six canonical growth-log events. Used everywhere — never free strings. */
export type EventType =
  | "planted"
  | "water"
  | "fertilize"
  | "ai_scan"
  | "note"
  | "harvested";

export type Severity = "none" | "mild" | "moderate" | "severe";
export type FertilizerCategory = "chemical" | "organic" | "unknown";

/* ── metadata shapes (growth_logs.metadata is JSONB) ────────────────────── */

export interface FertilizeMetadata {
  fertilizer_type?: string;
  fertilizer_category?: FertilizerCategory;
  amount?: string;
  pesticide_used?: boolean;
}

export interface NoteMetadata {
  pesticide_used?: boolean;
  pesticide_type?: string;
}

export interface AiScanMetadata {
  diagnosis?: string;
  severity?: Severity;
  confidence?: number;
}

export interface WaterMetadata {
  method?: string;
}

export type GrowthLogMetadata =
  | FertilizeMetadata
  | NoteMetadata
  | AiScanMetadata
  | WaterMetadata
  | Record<string, never>;

export interface FertilizerSummary {
  types: string[];
  count: number;
}

/* ── Row types (what a SELECT returns) ──────────────────────────────────── */

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_verified: boolean;
  created_at: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  location: string;
  /** Optional GPS pin (0006) — exact weather; null falls back to geocoding. */
  latitude: number | null;
  longitude: number | null;
  size: FarmSize;
  crop_type: string;
  background_type: BackgroundType;
  background_url: string | null;
  canvas_width: number;
  canvas_height: number;
  created_at: string;
}

export interface Zone {
  id: string;
  farm_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Plant {
  id: string;
  farm_id: string;
  zone_id: string | null;
  name: string;
  type: string;
  plant_date: string;
  expected_harvest_date: string | null;
  position_x: number; // 0.0–1.0
  position_y: number; // 0.0–1.0
  health_score: number | null; // null = grey "New" marker (D4)
  manual_status: ManualStatus;
  lifecycle_status: LifecycleStatus;
  created_at: string;
}

export interface GrowthLog {
  id: string;
  plant_id: string;
  event_type: EventType;
  note: string | null;
  photo_url: string | null;
  metadata: GrowthLogMetadata;
  created_at: string;
}

export interface AiAnalysis {
  id: string;
  plant_id: string;
  image_url: string;
  diagnosis: string;
  confidence: number; // 0–100
  severity: Severity;
  ai_sub_score: number; // 0–100
  recommendations: string[];
  created_at: string;
}

export interface HealthScoreHistory {
  id: string;
  plant_id: string;
  score: number; // 0–100
  created_at: string;
}

export interface HarvestPassport {
  id: string;
  plant_id: string;
  farm_id: string;
  harvest_date: string;
  grow_days: number;
  avg_health: number;
  fertilizer_summary: FertilizerSummary;
  pesticide_free: boolean;
  organic: boolean;
  ai_verified: boolean;
  ai_scan_count: number;
  qr_token: string;
  created_at: string;
}

/* ── Customer service (0007) ─────────────────────────────────────────────── */

export type RefundKind = "refund" | "return";
export type RefundStatus = "pending" | "approved" | "rejected";
export type SupportThread = "seller" | "admin";
export type SupportSender = "customer" | "seller" | "ai";

export interface RefundRequest {
  id: string;
  user_id: string;
  order_ref: string;
  item: string;
  farm: string;
  kind: RefundKind;
  reason: string;
  status: RefundStatus; // always starts 'pending' — RLS forbids self-approval
  created_at: string;
}

export interface OrderFeedback {
  id: string;
  user_id: string;
  order_ref: string;
  listing_id: string | null;
  rating: number; // 1–5
  comment: string;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  user_id: string;
  thread: SupportThread;
  order_ref: string | null;
  seller_name: string | null;
  sender: SupportSender;
  body: string;
  intent: string | null; // AI's classification (admin thread)
  created_at: string;
}

/* ── Insert types (what you pass to .insert(); DB fills the rest) ────────── */

export type FarmInsert = Omit<Farm, "id" | "created_at" | "latitude" | "longitude"> & {
  latitude?: number | null;
  longitude?: number | null;
};
export type ZoneInsert = Omit<Zone, "id" | "created_at">;
export type PlantInsert = Omit<Plant, "id" | "created_at">;
export type GrowthLogInsert = Omit<GrowthLog, "id" | "created_at">;
export type AiAnalysisInsert = Omit<AiAnalysis, "id" | "created_at">;
export type HealthScoreHistoryInsert = Omit<
  HealthScoreHistory,
  "id" | "created_at"
>;
export type HarvestPassportInsert = Omit<
  HarvestPassport,
  "id" | "created_at" | "qr_token"
> & { qr_token?: string };
export type RefundRequestInsert = Omit<
  RefundRequest,
  "id" | "created_at" | "status"
> & { status?: RefundStatus };
export type OrderFeedbackInsert = Omit<OrderFeedback, "id" | "created_at">;
export type SupportMessageInsert = Omit<SupportMessage, "id" | "created_at">;
