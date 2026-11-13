/**
 * Calendar dates in the app's home time zone.
 *
 * GreenMap serves Malaysian farms (one time zone, UTC+8, no daylight saving).
 * Servers run in UTC, so `new Date().toISOString().slice(0, 10)` is still
 * "yesterday" until 8 am in Malaysia — a plant harvested at 7 am would get the
 * wrong harvest date. Use these helpers for any "today" comparison instead.
 */
export const APP_TIME_ZONE = "Asia/Kuala_Lumpur";

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Malaysia as `YYYY-MM-DD` (the format `date` columns use). */
export function localDateISO(now: Date = new Date()): string {
  const parts = partsFormat.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Whole days from today (Malaysia) until a `YYYY-MM-DD` date. Negative when
 * the date has passed, 0 when it is today.
 */
export function daysUntilLocalDate(dateISO: string, now: Date = new Date()): number {
  const target = Date.parse(`${dateISO}T00:00:00Z`);
  const today = Date.parse(`${localDateISO(now)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}
