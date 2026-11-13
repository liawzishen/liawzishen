import type { Severity } from "@/types/database";

/**
 * AI scan result — the trusted shape after validation. `ai_sub_score` is ALWAYS
 * derived from `severity` here (never taken from the model or client), so it
 * can't be faked. `mock` marks a labelled sample (no key); `error` marks a
 * could-not-analyse result that must NOT be saved.
 */
export interface ScanResult {
  diagnosis: string;
  severity: Severity; // none | mild | moderate | severe
  confidence: number; // 0-100
  ai_sub_score: number; // mapped from severity
  recommendations: string[]; // 2-4 short steps
  mock?: boolean;
  error?: boolean;
}

const SEVERITY_SUBSCORE: Record<Severity, number> = {
  none: 95,
  mild: 75,
  moderate: 50,
  severe: 20,
};

const SEVERITIES: Severity[] = ["none", "mild", "moderate", "severe"];

export function subScoreForSeverity(sev: Severity): number {
  return SEVERITY_SUBSCORE[sev] ?? 50;
}

/** A valid severity ("Mild" and " SEVERE " are accepted), or null. */
function readSeverity(v: unknown): Severity | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return SEVERITIES.includes(s as Severity) ? (s as Severity) : null;
}

function clampConfidence(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

/**
 * Length caps. Scan text is stored and shown on the public passport, and the
 * save route receives it from the browser, so it must not be unbounded.
 */
const MAX_DIAGNOSIS_LENGTH = 400;
const MAX_RECOMMENDATION_LENGTH = 200;

function coerceDiagnosis(v: unknown, fallback: string): string {
  const text = typeof v === "string" ? v.trim() : "";
  return text ? text.slice(0, MAX_DIAGNOSIS_LENGTH) : fallback;
}

function coerceRecs(v: unknown): string[] {
  const recs = Array.isArray(v)
    ? v
        .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
        .map((r) => r.trim().slice(0, MAX_RECOMMENDATION_LENGTH))
    : [];
  return recs.length > 0 ? recs.slice(0, 4) : ["Monitor the plant and re-scan in a few days."];
}

/** Pull a JSON object out of a possibly fenced / prose-wrapped model reply. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

/** Parse a raw Gemini reply into a trusted ScanResult. Throws if unparseable. */
export function parseScanResult(raw: string): ScanResult {
  const parsed: unknown = JSON.parse(extractJson(raw));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Scan reply is not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  // An unknown severity must fail (→ retry → honest error). Guessing "none"
  // here would show a sick plant as healthy.
  const severity = readSeverity(obj.severity);
  if (!severity) throw new Error("Scan reply has no valid severity");
  return {
    diagnosis: coerceDiagnosis(obj.diagnosis, "No clear diagnosis from the photo."),
    severity,
    confidence: clampConfidence(obj.confidence),
    ai_sub_score: subScoreForSeverity(severity),
    recommendations: coerceRecs(obj.recommendations),
  };
}

/** Re-sanitise a client-supplied result before saving (don't trust the wire). */
export function sanitizeResult(input: unknown): ScanResult {
  const obj = (input !== null && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const severity = readSeverity(obj.severity) ?? "none";
  return {
    diagnosis: coerceDiagnosis(obj.diagnosis, "No diagnosis."),
    severity,
    confidence: clampConfidence(obj.confidence),
    ai_sub_score: subScoreForSeverity(severity), // recomputed, never trusted
    recommendations: coerceRecs(obj.recommendations),
  };
}

/**
 * Honest "couldn't analyse" result (docs/01 §6). Marked `error: true` so the UI
 * shows it as a failure (not "Healthy") and it can't be saved. `reason` tailors
 * the message to the failing stage.
 */
export function fallbackResult(reason: "ai" | "image" = "ai"): ScanResult {
  const diagnosis =
    reason === "image"
      ? "Couldn't load the uploaded photo from storage. Check that the plant-scans bucket exists and is public, then try again."
      : "The AI service didn't respond. Check your GEMINI_API_KEY (and that the Generative Language API is enabled for it), then try again.";
  return {
    diagnosis,
    severity: "none",
    confidence: 0,
    ai_sub_score: 50,
    recommendations: ["Resolve the issue above, then run the scan again."],
    error: true,
  };
}

/** Clearly-labelled sample used when GEMINI_API_KEY is not set, so the flow is testable. */
export function mockResult(cropType: string): ScanResult {
  return {
    diagnosis: `Sample analysis for ${cropType || "this plant"}: minor early leaf spotting, likely manageable. (Demo result — set GEMINI_API_KEY for real AI.)`,
    severity: "mild",
    confidence: 62,
    ai_sub_score: subScoreForSeverity("mild"),
    recommendations: [
      "Remove affected leaves and avoid overhead watering.",
      "Re-scan in 3-4 days to confirm improvement.",
    ],
    mock: true,
  };
}
