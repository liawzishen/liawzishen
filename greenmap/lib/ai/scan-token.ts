import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-only helpers that tie a saved scan to a real /api/ai/scan run.
 *
 * /api/ai/scan signs {user, plant, photo, result}; /api/ai/save-scan saves
 * only what a valid token carries. Without this, a grower could POST a
 * made-up "healthy" result straight to save-scan and earn the AI-Verified
 * badge without a photo, a model call or a scan credit.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface ScanClaims {
  u: string; // user id
  p: string; // plant id
  i: string; // image URL
  r: unknown; // validated scan result
  t: number; // issued at (ms)
}

/** Derived from the service-role key so no extra env var is needed. */
function signingKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update("greenmap-scan-token-v1").digest();
}

export function signScan(claims: {
  userId: string;
  plantId: string;
  imageUrl: string;
  result: unknown;
}): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload: ScanClaims = {
    u: claims.userId,
    p: claims.plantId,
    i: claims.imageUrl,
    r: claims.result,
    t: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** The signed photo + result, or null if the token is missing, forged,
 *  expired, or was issued to another user or plant. */
export function verifyScan(
  token: unknown,
  userId: string,
  plantId: string
): { imageUrl: string; result: unknown } | null {
  const key = signingKey();
  if (!key || typeof token !== "string") return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;

  const want = createHmac("sha256", key).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;

  let c: ScanClaims;
  try {
    c = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (c.u !== userId || c.p !== plantId) return null;
  if (typeof c.i !== "string" || typeof c.t !== "number") return null;
  const age = Date.now() - c.t;
  if (age < -60_000 || age > TOKEN_TTL_MS) return null;
  return { imageUrl: c.i, result: c.r };
}

/**
 * True only for a photo this plant's ScanUploader stored in our own
 * plant-scans bucket. /api/ai/scan fetches the URL server-side, so anything
 * looser would let a caller make the server request internal addresses (SSRF).
 */
export function isPlantScanUrl(url: string, plantId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  let u: URL;
  let b: URL;
  try {
    u = new URL(url);
    b = new URL(base);
  } catch {
    return false;
  }
  if (u.origin !== b.origin || u.search || u.hash || u.username || u.password) {
    return false;
  }
  const prefix = `/storage/v1/object/public/plant-scans/${plantId}/`;
  if (!u.pathname.startsWith(prefix)) return false;
  return /^[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i.test(u.pathname.slice(prefix.length));
}
