import {
  asNumber,
  cleanText,
  invalid,
  isDateISO,
  isOneOf,
  isUuid,
  valid,
  type Parsed,
} from "@/lib/api/parse";
import {
  MAX_AMOUNT_LENGTH,
  MAX_DETAIL_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PLANT_NAME_LENGTH,
} from "@/lib/farm/options";
import type {
  FertilizerCategory,
  GrowthLogMetadata,
  ManualStatus,
} from "@/types/database";

/* ── A new plant ─────────────────────────────────────────────────────────── */

export interface NewPlant {
  farmId: string;
  zoneId: string | null;
  name: string;
  type: string;
  expectedHarvestDate: string | null;
  /** Where it stands on the map, as fractions of the canvas (0–1). */
  position: { x: number; y: number };
}

/**
 * An expected harvest date outside this window is a typing mistake. One year
 * back is allowed: a plant added late can already be ready to harvest.
 */
const MAX_HARVEST_YEARS_AHEAD = 10;
const MAX_HARVEST_YEARS_BACK = 1;

/** `today` (YYYY-MM-DD) moved by whole years; only used to compare strings. */
const shiftYears = (today: string, years: number) =>
  `${Number(today.slice(0, 4)) + years}${today.slice(4)}`;

const clampToMap = (n: number) => Math.min(1, Math.max(0, n));

/** Check the body of POST /api/plants. `today` is YYYY-MM-DD (Malaysia). */
export function parseNewPlant(body: Record<string, unknown>, today: string): Parsed<NewPlant> {
  if (!isUuid(body.farmId)) return invalid("farmId is required.");
  const zoneId = body.zoneId == null || body.zoneId === "" ? null : body.zoneId;
  if (zoneId !== null && !isUuid(zoneId)) return invalid("The zone is not valid.");

  const name = cleanText(body.name, MAX_PLANT_NAME_LENGTH + 1);
  if (name.length < 1 || name.length > MAX_PLANT_NAME_LENGTH) {
    return invalid(`The plant name must be 1 to ${MAX_PLANT_NAME_LENGTH} characters.`);
  }
  const type = cleanText(body.type, MAX_PLANT_NAME_LENGTH + 1);
  if (type.length < 1 || type.length > MAX_PLANT_NAME_LENGTH) {
    return invalid(`The crop type must be 1 to ${MAX_PLANT_NAME_LENGTH} characters.`);
  }

  let expectedHarvestDate: string | null = null;
  if (body.expectedHarvestDate != null && body.expectedHarvestDate !== "") {
    if (
      !isDateISO(body.expectedHarvestDate) ||
      body.expectedHarvestDate < shiftYears(today, -MAX_HARVEST_YEARS_BACK) ||
      body.expectedHarvestDate > shiftYears(today, MAX_HARVEST_YEARS_AHEAD)
    ) {
      return invalid("The expected harvest date is not valid.");
    }
    expectedHarvestDate = body.expectedHarvestDate;
  }

  const position = (
    body.position !== null && typeof body.position === "object" ? body.position : {}
  ) as Record<string, unknown>;
  const x = asNumber(position.x);
  const y = asNumber(position.y);
  if (x === null || y === null) return invalid("The position on the map is missing.");

  return valid({
    farmId: body.farmId,
    zoneId,
    name,
    type,
    expectedHarvestDate,
    position: { x: clampToMap(x), y: clampToMap(y) },
  });
}

/* ── A care log ──────────────────────────────────────────────────────────── */

/** The care events a grower records by hand. */
export const CARE_LOG_TYPES = ["water", "fertilize", "note"] as const;
export type CareLogType = (typeof CARE_LOG_TYPES)[number];

const FERTILIZER_CATEGORIES = [
  "chemical",
  "organic",
  "unknown",
] as const satisfies readonly FertilizerCategory[];


/** A care log, checked and shaped the way `growth_logs` stores it. */
export interface CareLog {
  plantId: string;
  eventType: CareLogType;
  note: string | null;
  /**
   * Built here from typed fields, never copied from the request: passport
   * badges ("pesticide free", "organic") are worked out from these keys.
   */
  metadata: GrowthLogMetadata;
}

/** Check the body of POST /api/plants/log. */
export function parseCareLog(body: Record<string, unknown>): Parsed<CareLog> {
  if (!isUuid(body.plantId)) return invalid("plantId is required.");
  if (!isOneOf(body.type, CARE_LOG_TYPES)) {
    return invalid("type must be water, fertilize or note.");
  }
  const plantId = body.plantId;

  if (body.type === "water") {
    const method = cleanText(body.method, MAX_DETAIL_LENGTH);
    // No note: the event already says "watered".
    return valid({ plantId, eventType: "water", note: null, metadata: method ? { method } : {} });
  }

  const pesticideUsed = body.pesticideUsed === true;

  if (body.type === "fertilize") {
    const fertilizerType = cleanText(body.fertilizerType, MAX_DETAIL_LENGTH);
    const amount = cleanText(body.amount, MAX_AMOUNT_LENGTH);
    const category = isOneOf(body.category, FERTILIZER_CATEGORIES) ? body.category : "unknown";
    return valid({
      plantId,
      eventType: "fertilize",
      note: fertilizerType || null, // the fertilizer name IS the useful note
      metadata: {
        ...(fertilizerType ? { fertilizer_type: fertilizerType } : {}),
        fertilizer_category: category,
        ...(amount ? { amount } : {}),
        pesticide_used: pesticideUsed,
      },
    });
  }

  // A note keeps its line breaks; only the ends are trimmed.
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > MAX_NOTE_LENGTH) {
    return invalid(`A note must be 1 to ${MAX_NOTE_LENGTH} characters.`);
  }
  const pesticideType = cleanText(body.pesticideType, MAX_DETAIL_LENGTH);
  return valid({
    plantId,
    eventType: "note",
    note: text,
    metadata: pesticideUsed
      ? { pesticide_used: true, ...(pesticideType ? { pesticide_type: pesticideType } : {}) }
      : { pesticide_used: false },
  });
}

/* ── The grower's own status ─────────────────────────────────────────────── */

const MANUAL_STATUSES = [
  "healthy",
  "attention",
  "critical",
] as const satisfies readonly ManualStatus[];

/** Check the body of POST /api/plants/status. */
export function parseManualStatus(
  body: Record<string, unknown>
): Parsed<{ plantId: string; status: ManualStatus }> {
  if (!isUuid(body.plantId)) return invalid("plantId is required.");
  if (!isOneOf(body.status, MANUAL_STATUSES)) {
    return invalid("status must be healthy, attention or critical.");
  }
  return valid({ plantId: body.plantId, status: body.status });
}
