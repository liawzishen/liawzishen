import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { geminiVision } from "@/lib/ai/gemini-vision";
import { signScan } from "@/lib/ai/receipt";
import {
  parseScanResult,
  fallbackResult,
  mockResult,
  type ScanResult,
} from "@/lib/ai/validate";
import {
  reserveScanCredit,
  scansLeft,
  settleScanCredit,
} from "@/lib/billing/credits";
import { getScanAllowance } from "@/lib/billing/usage";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { guardRequest } from "@/lib/api/guard";
import { cleanText, isUuid, jsonError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

/** Vision calls can be slow; allow up to a minute on serverless hosts. */
export const maxDuration = 60;

/** The browser compresses photos to ~1 MB, so anything much larger is not ours. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/** Download the uploaded photo from our own storage as base64. */
async function loadImage(url: URL): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);

  const mimeType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!mimeType.startsWith("image/")) throw new Error(`not an image: ${mimeType}`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    throw new Error("image too large");
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large");
  return { base64: bytes.toString("base64"), mimeType };
}

/**
 * POST /api/ai/scan  { plantId?, imageUrl, cropType? }
 * Runs Gemini Vision and returns a validated result — NEVER saves (docs/01 §6).
 * One stricter retry on a parse failure, honest error fallback on any failure
 * (the real reason is logged server-side), and a labelled mock when no key.
 *
 * `imageUrl` must be a file in this project's `plant-scans` bucket: the server
 * downloads it, so an arbitrary URL would be a request-forgery hole.
 *
 * Credits: one is RESERVED before the AI call and released if the scan fails
 * (lib/billing/credits.ts). The reply carries a signed `receipt`; the save
 * route only stores a result that still matches it (lib/ai/receipt.ts).
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.scan });
  if (!guard.ok) return guard.response;
  const { supabase, user, body } = guard;

  if (body.plantId !== undefined && !isUuid(body.plantId)) {
    return jsonError("plantId is not a valid id", 400);
  }
  const plantId = body.plantId as string | undefined;
  const cropType = cleanText(body.cropType, 60);
  if (!body.imageUrl) return jsonError("imageUrl is required", 400);
  const imageUrl = publicStorageUrl(body.imageUrl, "plant-scans");
  if (!imageUrl) {
    return jsonError("imageUrl must be a photo uploaded to GreenMap", 400);
  }

  if (plantId) {
    const { data: plant } = await supabase
      .from("plants")
      .select("id")
      .eq("id", plantId)
      .single();
    if (!plant) return jsonError("Plant not found", 404);
  }

  // Credit gate — checked before any Gemini/image cost (spec: enforce for real).
  const outOfCredits = (resetsOn: string) =>
    jsonError("No scan credits left", 402, { code: "out_of_credits", resetsOn });
  const allowance = await getScanAllowance(supabase, user.id);
  if (allowance.remaining === 0) return outOfCredits(allowance.resetsOn);
  const reservation = await reserveScanCredit(user.id, allowance);
  if (reservation.kind === "denied") return outOfCredits(allowance.resetsOn);

  /** Settle the credit and build the reply for a finished scan. */
  const finish = async (result: ScanResult, succeeded: boolean) => {
    await settleScanCredit(user.id, allowance, reservation, succeeded);
    return NextResponse.json({
      result,
      scansLeft: scansLeft(allowance, reservation, succeeded),
      // Failed scans cannot be saved, so they get no receipt.
      receipt: succeeded
        ? signScan({ userId: user.id, plantId: plantId ?? "", imageUrl: imageUrl.href, result })
        : null,
    });
  };

  // Mock scans consume too, so the paywall arc works without an API key.
  if (!hasGeminiKey()) return finish(mockResult(cropType), true);

  let image: { base64: string; mimeType: string };
  try {
    image = await loadImage(imageUrl);
  } catch (e) {
    console.error("[/api/ai/scan] image fetch failed:", e);
    return finish(fallbackResult("image"), false);
  }

  const input = { imageBase64: image.base64, mimeType: image.mimeType, cropType };
  try {
    const raw = await geminiVision(input);
    let parsed;
    try {
      parsed = parseScanResult(raw);
    } catch {
      // Unparseable reply → one retry with a stricter prompt.
      parsed = parseScanResult(await geminiVision(input, { strict: true }));
    }
    return finish(parsed, true);
  } catch (e) {
    console.error("[/api/ai/scan] Gemini Vision failed:", e);
    return finish(fallbackResult("ai"), false);
  }
}
