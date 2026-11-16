import type { BackgroundType, FarmSize } from "@/types/database";

/*
 * The fixed choices and the upper limits of farm data. The forms offer
 * these choices; the server accepts nothing else (lib/farm/validate.ts).
 */

/** The 13 states and 3 federal territories a farm can be in. */
export const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
] as const;

export const FARM_SIZES = ["small", "medium", "large"] as const satisfies readonly FarmSize[];

export const BACKGROUND_TYPES = [
  "smart",
  "upload",
  "satellite",
] as const satisfies readonly BackgroundType[];

/** Longest farm name, crop name and zone name the forms allow. */
export const MAX_FARM_NAME_LENGTH = 60;
export const MAX_CROP_LENGTH = 40;
export const MAX_ZONE_NAME_LENGTH = 40;
export const MAX_PLANT_NAME_LENGTH = 60;
/** Care log: a note, and the short details (method, fertilizer, pesticide). */
export const MAX_NOTE_LENGTH = 2000;
export const MAX_DETAIL_LENGTH = 80;
export const MAX_AMOUNT_LENGTH = 40;

/** Zones per farm (06 spec — the setup wizard stops at 8 too). */
export const MAX_ZONES_PER_FARM = 8;

/*
 * Ceilings, not plans: far above any real farm, low enough that a script
 * cannot fill the database through one account. A farm with more plants
 * than this would not be usable on the map anyway.
 */
export const MAX_FARMS_PER_USER = 25;
export const MAX_PLANTS_PER_FARM = 2000;
