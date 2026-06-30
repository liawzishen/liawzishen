import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json(
      {
        error:
          "Satellite search isn't configured. Add MAPTILER_API_KEY to your environment.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let query: string | undefined;
  try {
    query = (await req.json())?.query;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  query = query?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "An address or place is required." },
      { status: 400 }
    );
  }

  try {
    // 1. Geocode the address → [lng, lat]. Bias to Malaysia for relevance.
    const geoUrl =
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json` +
      `?key=${key}&limit=1&country=my`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return NextResponse.json({ error: "Geocoding failed." }, { status: 502 });
    }
    const geo = (await geoRes.json()) as {
      features?: {
        center: [number, number];
        place_name?: string;
        text?: string;
      }[];
    };
    const feature = geo.features?.[0];
    if (!feature) {
      return NextResponse.json(
        { error: "No matching place found. Try a more specific address." },
        { status: 404 }
      );
    }
    const [lng, lat] = feature.center;

    // 2. Static satellite image (16:9) for that point. Try MapTiler first; if
    //    the satellite map isn't available on this key/plan, fall back to the
    //    keyless Esri World Imagery export so the feature still works.
    const mtUrl =
      `https://api.maptiler.com/maps/satellite/static/` +
      `${lng},${lat},16/640x360@2x.jpg?key=${key}`;
    let imgRes = await fetch(mtUrl);
    if (!imgRes.ok) {
      const dLat = 0.0025;
      const dLng = (dLat * (640 / 360)) / Math.cos((lat * Math.PI) / 180);
      const esriUrl =
        `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
        `?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}` +
        `&bboxSR=4326&imageSR=3857&size=1280,720&format=jpg&f=image`;
      imgRes = await fetch(esriUrl);
    }
    if (!imgRes.ok) {
      const detail = await imgRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Satellite image request failed (${imgRes.status}). ${detail.slice(0, 160)}`,
        },
        { status: 502 }
      );
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
      return NextResponse.json(
        { error: `Could not save the image: ${upErr.message}` },
        { status: 500 }
      );
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("farm-backgrounds").getPublicUrl(path);

    return NextResponse.json({
      url: publicUrl,
      place_name: feature.place_name ?? feature.text ?? query,
      center: [lng, lat],
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the map service. Please try again." },
      { status: 502 }
    );
  }
}
