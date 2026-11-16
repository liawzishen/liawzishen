import {
  asNumber,
  cleanText,
  invalid,
  isOneOf,
  valid,
  type Parsed,
} from "@/lib/api/parse";
import { publicStorageUrl } from "@/lib/storage/public-url";
import type { BackgroundType, FarmSize } from "@/types/database";
import {
  BACKGROUND_TYPES,
  FARM_SIZES,
  MALAYSIAN_STATES,
  MAX_CROP_LENGTH,
  MAX_FARM_NAME_LENGTH,
  MAX_ZONES_PER_FARM,
  MAX_ZONE_NAME_LENGTH,
} from "./options";

/** A new farm, checked and ready to be written. */
export interface NewFarm {
  name: string;
  location: string;
  size: FarmSize;
  cropType: string;
  backgroundType: BackgroundType;
  backgroundUrl: string | null;
  /** GPS pin, or null when the grower did not set one. */
  pin: { latitude: number; longitude: number } | null;
  zones: { name: string; color: string }[];
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Check the body of POST /api/farms.
 * `supabaseUrl` is only a parameter so tests can run without the env var.
 */
export function parseNewFarm(
  body: Record<string, unknown>,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): Parsed<NewFarm> {
  const name = cleanText(body.name, MAX_FARM_NAME_LENGTH + 1);
  if (name.length < 2 || name.length > MAX_FARM_NAME_LENGTH) {
    return invalid(`The farm name must be 2 to ${MAX_FARM_NAME_LENGTH} characters.`);
  }
  if (!isOneOf(body.location, MALAYSIAN_STATES)) {
    return invalid("Choose the state the farm is in.");
  }
  if (!isOneOf(body.size, FARM_SIZES)) return invalid("Choose a farm size.");

  const cropType = cleanText(body.cropType, MAX_CROP_LENGTH + 1);
  if (cropType.length < 2 || cropType.length > MAX_CROP_LENGTH) {
    return invalid(`The main crop must be 2 to ${MAX_CROP_LENGTH} characters.`);
  }
  if (!isOneOf(body.backgroundType, BACKGROUND_TYPES)) {
    return invalid("Choose a map background.");
  }

  // The background is shown as an image, so it may only be a photo in OUR
  // storage — never an address somebody typed into the request.
  let backgroundUrl: string | null = null;
  if (body.backgroundType !== "smart" && body.backgroundUrl != null) {
    const url = publicStorageUrl(body.backgroundUrl, "farm-backgrounds", supabaseUrl);
    if (!url) return invalid("The map background must be a photo uploaded to GreenMap.");
    backgroundUrl = url.href;
  }

  // A GPS pin is both numbers or nothing.
  let pin: NewFarm["pin"] = null;
  if (body.latitude != null || body.longitude != null) {
    const latitude = asNumber(body.latitude);
    const longitude = asNumber(body.longitude);
    if (
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return invalid("The GPS position is not valid.");
    }
    pin = { latitude, longitude };
  }

  const rawZones = body.zones ?? [];
  if (!Array.isArray(rawZones) || rawZones.length > MAX_ZONES_PER_FARM) {
    return invalid(`A farm can have at most ${MAX_ZONES_PER_FARM} zones.`);
  }
  const zones: NewFarm["zones"] = [];
  for (const raw of rawZones) {
    const zone = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const zoneName = cleanText(zone.name, MAX_ZONE_NAME_LENGTH + 1);
    if (zoneName.length < 1 || zoneName.length > MAX_ZONE_NAME_LENGTH) {
      return invalid(`A zone name must be 1 to ${MAX_ZONE_NAME_LENGTH} characters.`);
    }
    if (typeof zone.color !== "string" || !HEX_COLOR.test(zone.color)) {
      return invalid("A zone colour is not valid.");
    }
    zones.push({ name: zoneName, color: zone.color.toUpperCase() });
  }

  return valid({
    name,
    location: body.location,
    size: body.size,
    cropType,
    backgroundType: body.backgroundType,
    backgroundUrl,
    pin,
    zones,
  });
}
