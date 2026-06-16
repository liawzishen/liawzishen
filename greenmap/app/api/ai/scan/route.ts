import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geminiVision } from "@/lib/ai/gemini-vision";
import { parseScanResult, fallbackResult, mockResult } from "@/lib/ai/validate";

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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ result: mockResult(cropType) });
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
    return NextResponse.json({ result: fallbackResult("image") });
  }

  try {
    const raw = await geminiVision({ imageBase64, mimeType, cropType });
    try {
      return NextResponse.json({ result: parseScanResult(raw) });
    } catch {
      const retry = await geminiVision(
        { imageBase64, mimeType, cropType },
        { strict: true }
      );
      return NextResponse.json({ result: parseScanResult(retry) });
    }
  } catch (e) {
    console.error("[/api/ai/scan] Gemini Vision failed:", e);
    return NextResponse.json({ result: fallbackResult("ai") });
  }
}
