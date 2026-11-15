import { createHmac, timingSafeEqual } from "node:crypto";
import { sanitizeResult, type ScanResult } from "./validate";

/*
 * Proof that a scan result came from the server.
 *
 * A scan happens in two steps: /api/ai/scan returns the AI's result to the
 * browser, and — only if the grower taps Save — the browser sends it back to
 * /api/ai/save-scan. Without proof, the second step would have to trust the
 * browser: anyone could "save" a result that says Healthy, 100% confident,
 * without ever running a scan, and it would count on the Harvest Passport.
 *
 * So the scan route signs what it returns (an HMAC: a fingerprint that needs
 * a secret key to make), and the save route recomputes the fingerprint. Any
 * change — another plant, another photo, a different diagnosis, another
 * user, or a receipt older than two hours — makes it not match.
 *
 * The key is derived from the service-role key, which both routes already
 * need and which never leaves the server. Nothing is stored.
 */

/** A receipt is only good for this long after the scan. */
export const RECEIPT_TTL_MS = 2 * 60 * 60 * 1000;

export interface ScanClaim {
  userId: string;
  plantId: string;
  imageUrl: string;
  result: unknown;
}

function signingKey(secret: string | undefined): Buffer | null {
  if (!secret) return null;
  // A separate key for this one purpose, so the receipt can never be
  // mistaken for anything else signed with the same secret.
  return createHmac("sha256", secret).update("greenmap:scan-receipt:v1").digest();
}

/** The exact fields a receipt covers, in a fixed order. */
function fingerprintInput(claim: ScanClaim, expiresAt: number): string {
  const result: ScanResult = sanitizeResult(claim.result);
  return JSON.stringify([
    claim.userId,
    claim.plantId,
    claim.imageUrl,
    result.diagnosis,
    result.severity,
    result.confidence,
    result.recommendations,
    expiresAt,
  ]);
}

function fingerprint(key: Buffer, claim: ScanClaim, expiresAt: number): Buffer {
  return createHmac("sha256", key).update(fingerprintInput(claim, expiresAt)).digest();
}

/**
 * Sign a scan result. Returns null when no service-role key is configured
 * (saving a scan needs that key anyway).
 */
export function signScan(
  claim: ScanClaim,
  now: number = Date.now(),
  secret: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY
): string | null {
  const key = signingKey(secret);
  if (!key) return null;
  const expiresAt = now + RECEIPT_TTL_MS;
  return `${expiresAt}.${fingerprint(key, claim, expiresAt).toString("base64url")}`;
}

/** True only for an unexpired receipt that matches every field of `claim`. */
export function verifyScan(
  claim: ScanClaim,
  receipt: unknown,
  now: number = Date.now(),
  secret: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY
): boolean {
  const key = signingKey(secret);
  if (!key || typeof receipt !== "string" || receipt.length > 200) return false;

  const dot = receipt.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(receipt.slice(0, dot));
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now) return false;
  // A receipt cannot claim to live longer than one we would have issued.
  if (expiresAt > now + RECEIPT_TTL_MS) return false;

  const given = Buffer.from(receipt.slice(dot + 1), "base64url");
  const expected = fingerprint(key, claim, expiresAt);
  // Constant-time compare: the time it takes must not hint at the answer.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
