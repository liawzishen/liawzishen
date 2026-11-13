import { NextResponse } from "next/server";
import {
  cleanText,
  getSessionUser,
  invalidJson,
  jsonError,
  readJsonObject,
  unauthorized,
} from "@/lib/api/http";

const SCOPE = "/api/satellite";

/** Map services must answer quickly or the wizard falls back. */
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_QUERY_LENGTH = 200;

const upstream = (url: string) =>
  fetch(url, { cache: "no-store", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });

/**
 * POST /api/satellite  { query: string }
 *
 * Geocodes a farm address with MapTiler, fetches a static satellite image,
 * stores it in the public `farm-backgrounds` bucket, and returns its URL.
 * The MapTiler key never leaves the server. Returns 503 if unconfigured so
 * the UI can fall back to the smart background.
 */
export async function POST(req: Request) {
  const key = process.env.MAPTILER_API_KEY;
  if (!key) {
    return jsonError(
      "Satellite search isn't configured. Add MAPTILER_API_KEY to your environment.",
      503
    );
  }

  const { supabase, user } = await getSessionUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(req);
  if (!body) return invalidJson();
  const query = cleanText(body.query, MAX_QUERY_LENGTH);
  if (!query) return jsonError("An address or place is required.", 400);

  try {
    // 1. Geocode the address → [lng, lat]. Bias to Malaysia for relevance.
    const geoUrl =
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json` +
      `?key=${key}&limit=1&country=my`;
    const geoRes = await upstream(geoUrl);
    if (!geoRes.ok) return jsonError("Geocoding failed.", 502);
    const geo = (await geoRes.json()) as {
      features?: {
        center: [number, number];
        place_name?: string;
        text?: string;
      }[];
    };
    const feature = geo.features?.[0];
    if (!feature) {
      return jsonError("No matching place found. Try a more specific address.", 404);
    }
    const [lng, lat] = feature.center;

    // 2. Static satellite image (16:9) for that point. Try MapTiler first; if
    //    the satellite map isn't available on this key/plan, fall back to the
    //    keyless Esri World Imagery export so the feature still works.
    const mtUrl =
      `https://api.maptiler.com/maps/satellite/static/` +
      `${lng},${lat},16/640x360@2x.jpg?key=${key}`;
    let imgRes = await upstream(mtUrl);
    if (!imgRes.ok) {
      const dLat = 0.0025;
      const dLng = (dLat * (640 / 360)) / Math.cos((lat * Math.PI) / 180);
      const esriUrl =
        `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
        `?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}` +
        `&bboxSR=4326&imageSR=3857&size=1280,720&format=jpg&f=image`;
      imgRes = await upstream(esriUrl);
    }
    if (!imgRes.ok) {
      const detail = await imgRes.text().catch(() => "");
      console.error(`[${SCOPE}] image request failed (${imgRes.status}):`, detail.slice(0, 300));
      return jsonError("Could not load a satellite image for that place.", 502);
    }
    const bytes = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

    // 3. Store it in the public bucket (key-free, permanent URL).
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${user.id}/satellite-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("farm-backgrounds")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      console.error(`[${SCOPE}] upload failed:`, upErr);
      return jsonError("Could not save the image. Please try again.", 500);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("farm-backgrounds").getPublicUrl(path);

    return NextResponse.json({
      url: publicUrl,
      place_name: feature.place_name ?? feature.text ?? query,
      center: [lng, lat],
    });
  } catch (e) {
    console.error(`[${SCOPE}] map service unreachable:`, e);
    return jsonError("Could not reach the map service. Please try again.", 502);
  }
}
