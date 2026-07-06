/**
 * Farm weather — Open-Meteo integration (server components only).
 *
 * Open-Meteo is free and keyless, so there is no secret to manage and
 * nothing to expire during a demo. Two endpoints are used:
 *   1. Geocoding — farms store a free-text `location` (no coordinates), so
 *      the name is resolved once and cached for a day.
 *   2. Forecast — daily temperature/rain plus hourly root-zone soil
 *      moisture (3–9 cm), aggregated here into one row per day.
 *
 * Demo reliability rule: any network/parse failure returns a deterministic
 * synthetic dataset shaped like a typical Malaysian week and tagged
 * `source: "fallback"` — the map page must never break on stage.
 */

export interface DailyWeather {
  date: string; // YYYY-MM-DD (farm-local, timezone=auto)
  weekday: string; // "Mon"
  tempMax: number | null; // °C
  tempMin: number | null; // °C
  rainProb: number | null; // 0–100 %
  precipMm: number | null; // mm
  soilMoisture: number | null; // volumetric m³/m³ (~0–0.45)
  weatherCode: number | null; // WMO code
  isToday: boolean;
  isPast: boolean;
}

export interface WeatherBundle {
  /** Resolved place label ("Cameron Highlands" / "Kuala Lumpur (default)"). */
  locationLabel: string;
  /** 2 past days + today + 6 forecast days. */
  days: DailyWeather[];
  today: DailyWeather;
  source: "live" | "fallback";
}

/** Days of history requested — today sits at this index in `days`. */
const PAST_DAYS = 2;
const FORECAST_DAYS = 7;

/** Volumetric soil moisture below this reads as "dry" for advice + charts. */
export const SOIL_DRY_THRESHOLD = 0.18;

/** Kuala Lumpur — sensible default when a location can't be geocoded. */
const DEFAULT_COORDS = { latitude: 3.139, longitude: 101.687, label: "Kuala Lumpur (default)" };

function weekdayOf(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

/** WMO weather code → emoji (coarse buckets are enough for farmers). */
export function weatherEmoji(code: number | null): string {
  if (code === null) return "🌤️";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

/** Milliseconds before a weather request is abandoned in favour of the
 *  sample-data fallback. A slow-but-alive Open-Meteo must not hang the page. */
const WEATHER_TIMEOUT_MS = 3500;

/**
 * `fetch` bounded by a timeout via Promise.race. We deliberately do NOT pass
 * an AbortSignal to `fetch`: a signal opts the request out of Next's Data
 * Cache, so the forecast would re-fetch on every render. Racing a timeout
 * promise instead keeps caching intact and still bounds the wait — on
 * timeout this rejects and the caller's try/catch falls back to sample data,
 * so a sluggish network degrades gracefully instead of blocking render.
 */
async function fetchWithTimeout(
  url: string,
  init: { next?: { revalidate: number } }
): Promise<Response> {
  const timeout = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error("weather request timed out")), WEATHER_TIMEOUT_MS)
  );
  return Promise.race([fetch(url, init), timeout]);
}

async function geocode(
  location: string
): Promise<{ latitude: number; longitude: number; label: string }> {
  // Try the full string first, then the part before the first comma
  // ("Cameron Highlands, Pahang" → "Cameron Highlands").
  const queries = [location, location.split(",")[0]]
    .map((q) => q.trim())
    .filter((q, i, all) => q.length > 1 && all.indexOf(q) === i);

  for (const q of queries) {
    const res = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) continue;
    const json = (await res.json()) as {
      results?: { latitude: number; longitude: number; name: string }[];
    };
    const hit = json.results?.[0];
    if (hit) return { latitude: hit.latitude, longitude: hit.longitude, label: hit.name };
  }
  return DEFAULT_COORDS;
}

/** Average the hourly soil-moisture series into one value per date. */
function dailySoilMoisture(
  hourlyTime: string[],
  hourlyValues: (number | null)[]
): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  hourlyTime.forEach((t, i) => {
    const v = hourlyValues[i];
    if (v === null || v === undefined) return;
    const date = t.slice(0, 10);
    const acc = sums.get(date) ?? { total: 0, n: 0 };
    acc.total += v;
    acc.n += 1;
    sums.set(date, acc);
  });
  const out = new Map<string, number>();
  sums.forEach((acc, date) => out.set(date, acc.total / acc.n));
  return out;
}

export async function getFarmWeather(farm: {
  location: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<WeatherBundle> {
  try {
    // A GPS pin from farm setup beats geocoding the free-text state name —
    // the forecast then matches the exact field, not the state capital.
    const coords =
      farm.latitude != null && farm.longitude != null
        ? {
            latitude: farm.latitude,
            longitude: farm.longitude,
            label: `${farm.location} · farm GPS pin`,
          }
        : await geocode(farm.location);

    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      daily:
        "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
      hourly: "soil_moisture_3_to_9cm",
      past_days: String(PAST_DAYS),
      forecast_days: String(FORECAST_DAYS),
      timezone: "auto",
    });
    const res = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) throw new Error(`forecast ${res.status}`);

    const json = (await res.json()) as {
      daily: {
        time: string[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_sum: (number | null)[];
        precipitation_probability_max: (number | null)[];
        weather_code: (number | null)[];
      };
      hourly: { time: string[]; soil_moisture_3_to_9cm: (number | null)[] };
    };

    const moisture = dailySoilMoisture(
      json.hourly?.time ?? [],
      json.hourly?.soil_moisture_3_to_9cm ?? []
    );

    const days: DailyWeather[] = json.daily.time.map((date, i) => ({
      date,
      weekday: weekdayOf(date),
      tempMax: json.daily.temperature_2m_max[i] ?? null,
      tempMin: json.daily.temperature_2m_min[i] ?? null,
      rainProb: json.daily.precipitation_probability_max[i] ?? null,
      precipMm: json.daily.precipitation_sum[i] ?? null,
      soilMoisture: moisture.get(date) ?? null,
      weatherCode: json.daily.weather_code[i] ?? null,
      isToday: i === PAST_DAYS, // past_days rows come first, then today
      isPast: i < PAST_DAYS,
    }));
    if (days.length < PAST_DAYS + 1) throw new Error("forecast too short");

    return {
      locationLabel: coords.label,
      days,
      today: days[PAST_DAYS],
      source: "live",
    };
  } catch {
    return fallbackWeather();
  }
}

/**
 * Deterministic sample week (typical lowland-Malaysia climate) so the page
 * always renders — even with no network. Tagged so the UI can say "sample".
 */
function fallbackWeather(): WeatherBundle {
  const tempMax = [32, 33, 31, 33, 34, 30, 31, 32, 33];
  const tempMin = [24, 25, 24, 25, 26, 23, 24, 24, 25];
  const rainProb = [70, 35, 80, 25, 15, 90, 60, 45, 30];
  const precipMm = [8.2, 1.4, 12.6, 0.4, 0, 18.9, 6.1, 2.8, 1.1];
  const soil = [0.28, 0.24, 0.31, 0.22, 0.17, 0.34, 0.29, 0.25, 0.22];
  const codes = [80, 2, 95, 1, 0, 95, 80, 3, 2];

  const base = new Date();
  const days: DailyWeather[] = tempMax.map((_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + (i - PAST_DAYS));
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      weekday: weekdayOf(date),
      tempMax: tempMax[i],
      tempMin: tempMin[i],
      rainProb: rainProb[i],
      precipMm: precipMm[i],
      soilMoisture: soil[i],
      weatherCode: codes[i],
      isToday: i === PAST_DAYS,
      isPast: i < PAST_DAYS,
    };
  });

  return {
    locationLabel: "Sample data (offline)",
    days,
    today: days[PAST_DAYS],
    source: "fallback",
  };
}
