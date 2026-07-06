import { SOIL_DRY_THRESHOLD, type DailyWeather } from "./fetch";

/**
 * Daily watering advisory — pure display logic mapping today's weather to a
 * one-line recommendation for the farmer. Deliberately simple, deterministic
 * rules (no AI): rain first, then dryness + heat.
 */

export type AdviceLevel = "skip" | "good" | "water" | "urgent";

export interface WateringAdvice {
  level: AdviceLevel;
  title: string;
  detail: string;
  /** Hex accent — matches the app's status palette. */
  color: string;
  icon: string;
}

export function wateringAdvice(today: DailyWeather): WateringAdvice {
  const rain = today.rainProb ?? 0;
  const dry =
    today.soilMoisture !== null && today.soilMoisture < SOIL_DRY_THRESHOLD;
  const hot = today.tempMax !== null && today.tempMax >= 33;

  if (rain >= 60) {
    return {
      level: "skip",
      title: "Rain expected today",
      detail: `${Math.round(rain)}% chance of rain — you can likely skip watering.`,
      color: "#007aff",
      icon: "🌧️",
    };
  }
  if (dry && hot) {
    return {
      level: "urgent",
      title: "Hot and dry",
      detail: "Soil is dry and heat is high — water in the early morning and again in the evening.",
      color: "#ff3b30",
      icon: "🔥",
    };
  }
  if (dry) {
    return {
      level: "water",
      title: "Soil is drying out",
      detail: "Root-zone moisture is below the dry threshold — water your plants today.",
      color: "#ff9f0a",
      icon: "💧",
    };
  }
  return {
    level: "good",
    title: "Soil moisture is good",
    detail: "No extra watering needed today — keep to your normal routine.",
    color: "#4f772d",
    icon: "✅",
  };
}
