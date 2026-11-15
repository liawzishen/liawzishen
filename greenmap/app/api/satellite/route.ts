import { NextResponse } from "next/server";
import { guardRequest } from "@/lib/api/guard";
import { cleanText, jsonError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/satellite";

/** Map services must answer quickly or the wizard falls back. */
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_QUERY_LENGTH = 200;
/** A 1280×720 satellite JPEG is well under 1 MB; anything huge is not ours. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

  const guard = await guardRequest(req, { limit: LIMITS.satellite });
  if (!guard.ok) return guard.response;
  const { supabase, user, body } = guard;
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
        center?: [number, number];
        place_name?: string;
        text?: string;
      }[];
    };
    const feature = geo.features?.[0];
    if (!feature) {
      return jsonError("No matching place found. Try a more specific address.", 404);
    }
    const [lng, lat] = feature.center ?? [NaN, NaN];
    // The numbers go into the next URLs — they must really be numbers.
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return jsonError("No matching place found. Try a more specific address.", 404);
    }

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
    // Only ever store an image, whatever the map service answered with.
    const isPng = (imgRes.headers.get("content-type") ?? "").includes("png");
    const contentType = isPng ? "image/png" : "image/jpeg";
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return jsonError("Could not load a satellite image for that place.", 502);
    }

    // 3. Store it in the public bucket (key-free, permanent URL).
    const ext = isPng ? "png" : "jpg";
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
