import { describe, expect, it } from "vitest";
import { wateringAdvice } from "./advice";
import { SOIL_DRY_THRESHOLD, weatherEmoji, type DailyWeather } from "./fetch";

const day = (over: Partial<DailyWeather> = {}): DailyWeather => ({
  date: "2026-07-10",
  weekday: "Fri",
  tempMax: 31,
  tempMin: 24,
  rainProb: 20,
  precipMm: 0,
  soilMoisture: 0.25,
  weatherCode: 1,
  isToday: true,
  isPast: false,
  ...over,
});

describe("wateringAdvice", () => {
  it("says skip when rain is likely, even if the soil is dry and hot", () => {
    expect(
      wateringAdvice(day({ rainProb: 60, soilMoisture: 0.1, tempMax: 36 }))
    ).toMatchObject({ level: "skip", rainProb: 60 });
  });

  it("is urgent when the soil is dry and the day is hot", () => {
    expect(wateringAdvice(day({ soilMoisture: SOIL_DRY_THRESHOLD - 0.01, tempMax: 33 })).level).toBe(
      "urgent"
    );
  });

  it("says water when the soil is dry but the day is not hot", () => {
    expect(wateringAdvice(day({ soilMoisture: 0.1, tempMax: 30 })).level).toBe("water");
  });

  it("says good when the soil is moist", () => {
    expect(wateringAdvice(day()).level).toBe("good");
    expect(wateringAdvice(day({ soilMoisture: SOIL_DRY_THRESHOLD })).level).toBe("good");
  });

  it("does not guess when data is missing", () => {
    const advice = wateringAdvice(day({ rainProb: null, soilMoisture: null, tempMax: null }));
    expect(advice).toMatchObject({ level: "good", rainProb: 0 });
  });
});

describe("weatherEmoji", () => {
  it("maps WMO codes to coarse icons", () => {
    expect(weatherEmoji(0)).toBe("☀️");
    expect(weatherEmoji(3)).toBe("☁️");
    expect(weatherEmoji(63)).toBe("🌧️");
    expect(weatherEmoji(95)).toBe("⛈️");
    expect(weatherEmoji(null)).toBe("🌤️");
  });
});
