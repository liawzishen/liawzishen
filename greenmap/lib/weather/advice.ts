import { SOIL_DRY_THRESHOLD, type DailyWeather } from "./fetch";

/**
 * Daily watering advisory — pure logic mapping today's weather to a
 * recommendation level. Deliberately simple, deterministic rules (no AI):
 * rain first, then dryness + heat.
 *
 * Display strings live in the i18n dictionaries (`t.advice[level]`), so the
 * advisory renders in the farmer's chosen language; this module only decides
 * WHICH advice applies and carries the numbers the strings need.
 */

export type AdviceLevel = "skip" | "good" | "water" | "urgent";

export interface WateringAdvice {
  level: AdviceLevel;
  /** Hex accent — matches the app's status palette. */
  color: string;
  icon: string;
  /** Rounded rain probability (%) — used by the "skip" detail string. */
  rainProb: number;
}

export function wateringAdvice(today: DailyWeather): WateringAdvice {
  const rain = Math.round(today.rainProb ?? 0);
  const dry =
    today.soilMoisture !== null && today.soilMoisture < SOIL_DRY_THRESHOLD;
  const hot = today.tempMax !== null && today.tempMax >= 33;

  if (rain >= 60) return { level: "skip", color: "#007aff", icon: "🌧️", rainProb: rain };
  if (dry && hot) return { level: "urgent", color: "#ff3b30", icon: "🔥", rainProb: rain };
  if (dry) return { level: "water", color: "#ff9f0a", icon: "💧", rainProb: rain };
  return { level: "good", color: "#4f772d", icon: "✅", rainProb: rain };
}
