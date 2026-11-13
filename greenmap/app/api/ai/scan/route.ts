import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { geminiVision } from "@/lib/ai/gemini-vision";
import { parseScanResult, fallbackResult, mockResult } from "@/lib/ai/validate";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";
import { publicStorageUrl } from "@/lib/storage/public-url";
import {
  cleanText,
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  unauthorized,
} from "@/lib/api/http";

/** Vision calls can be slow; allow up to a minute on serverless hosts. */
export const maxDuration = 60;

/** The browser compresses photos to ~1 MB, so anything much larger is not ours. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Record one consumed credit (service role — billing tables are read-only
 * for clients). Called ONLY on a successful analysis: failures cost nothing.
 * When the monthly allowance is exhausted the scan is funded by a purchased
 * bonus credit, so bonus_scans is decremented too. Accounting must never
 * break a scan that already succeeded — errors are logged, not thrown.
 */
async function consumeScanCredit(userId: string, allowance: ScanAllowance) {
  if (allowance.degraded) return; // 0005 not applied — nothing to write to
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_scan_usage").insert({ user_id: userId });
    if (error) throw error;
    if (
      allowance.limit !== null &&
      allowance.used >= allowance.limit &&
      allowance.bonus > 0
    ) {
      await admin
        .from("profiles")
        .update({ bonus_scans: allowance.bonus - 1 })
        .eq("id", userId);
    }
  } catch (e) {
    console.error("[/api/ai/scan] credit accounting failed:", e);
  }
}

const scansLeftAfter = (a: ScanAllowance) =>
  a.remaining === null ? null : Math.max(0, a.remaining - 1);

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
 */
export async function POST(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();

  const plantId = typeof body.plantId === "string" ? body.plantId : undefined;
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
  const allowance = await getScanAllowance(supabase, user.id);
  if (allowance.remaining === 0) {
    return jsonError("No scan credits left", 402, {
      code: "out_of_credits",
      resetsOn: allowance.resetsOn,
    });
  }

  if (!hasGeminiKey()) {
    // Mock scans consume too, so the paywall arc works without an API key.
    await consumeScanCredit(user.id, allowance);
    return NextResponse.json({
      result: mockResult(cropType),
      scansLeft: scansLeftAfter(allowance),
    });
  }

  let image: { base64: string; mimeType: string };
  try {
    image = await loadImage(imageUrl);
  } catch (e) {
    console.error("[/api/ai/scan] image fetch failed:", e);
    // Failed analyses consume nothing — balance unchanged.
    return NextResponse.json({
      result: fallbackResult("image"),
      scansLeft: allowance.remaining,
    });
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
    await consumeScanCredit(user.id, allowance);
    return NextResponse.json({ result: parsed, scansLeft: scansLeftAfter(allowance) });
  } catch (e) {
    console.error("[/api/ai/scan] Gemini Vision failed:", e);
    return NextResponse.json({
      result: fallbackResult("ai"),
      scansLeft: allowance.remaining,
    });
  }
}
