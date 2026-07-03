import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiVision } from "@/lib/ai/gemini-vision";
import { parseScanResult, fallbackResult, mockResult } from "@/lib/ai/validate";
import { getScanAllowance, type ScanAllowance } from "@/lib/billing/usage";

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

/**
 * POST /api/ai/scan  { plantId?, imageUrl, cropType? }
 * Runs Gemini Vision and returns a validated result — NEVER saves (docs/01 §6).
 * One stricter retry on a parse failure, honest error fallback on any failure
 * (the real reason is logged server-side), and a labelled mock when no key.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { plantId?: string; imageUrl?: string; cropType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { plantId, imageUrl, cropType = "" } = body;
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  if (plantId) {
    const { data: plant } = await supabase
      .from("plants")
      .select("id")
      .eq("id", plantId)
      .single();
    if (!plant) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
  }

  // Credit gate — checked before any Gemini/image cost (spec: enforce for real).
  const allowance = await getScanAllowance(supabase, user.id);
  if (allowance.remaining === 0) {
    return NextResponse.json(
      {
        error: "No scan credits left",
        code: "out_of_credits",
        resetsOn: allowance.resetsOn,
      },
      { status: 402 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    // Mock scans consume too, so the paywall arc works without an API key.
    await consumeScanCredit(user.id, allowance);
    return NextResponse.json({
      result: mockResult(cropType),
      scansLeft: scansLeftAfter(allowance),
    });
  }

  let imageBase64: string;
  let mimeType = "image/jpeg";
  try {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`image fetch ${r.status}`);
    imageBase64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    mimeType = r.headers.get("content-type") ?? "image/jpeg";
  } catch (e) {
    console.error("[/api/ai/scan] image fetch failed:", e);
    // Failed analyses consume nothing — balance unchanged.
    return NextResponse.json({
      result: fallbackResult("image"),
      scansLeft: allowance.remaining,
    });
  }

  try {
    const raw = await geminiVision({ imageBase64, mimeType, cropType });
    try {
      const parsed = parseScanResult(raw);
      await consumeScanCredit(user.id, allowance);
      return NextResponse.json({ result: parsed, scansLeft: scansLeftAfter(allowance) });
    } catch {
      const retry = await geminiVision(
        { imageBase64, mimeType, cropType },
        { strict: true }
      );
      const parsed = parseScanResult(retry);
      await consumeScanCredit(user.id, allowance);
      return NextResponse.json({ result: parsed, scansLeft: scansLeftAfter(allowance) });
    }
  } catch (e) {
    console.error("[/api/ai/scan] Gemini Vision failed:", e);
    return NextResponse.json({
      result: fallbackResult("ai"),
      scansLeft: allowance.remaining,
    });
  }
}
