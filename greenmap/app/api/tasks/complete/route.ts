import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateManyPlantScores } from "@/lib/health/recalculate";

/**
 * POST /api/tasks/complete  { action: "water" | "fertilize", plantIds: string[] }
 *
 * Marks one or many care tasks done by logging the real care event for each
 * owned plant, then recalculating its score. Powers both the per-card checkbox
 * (one id) and the "Water All / Fertilize All" batch buttons (many ids).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { action?: string; plantIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "water" && action !== "fertilize") {
    return NextResponse.json({ error: "action must be water or fertilize" }, { status: 400 });
  }
  const plantIds = Array.isArray(body.plantIds)
    ? body.plantIds.filter((x): x is string => typeof x === "string")
    : [];
  if (plantIds.length === 0) {
    return NextResponse.json({ error: "plantIds required" }, { status: 400 });
  }

  // Ownership: RLS only returns the caller's own plants.
  const { data: owned } = await supabase
    .from("plants")
    .select("id")
    .in("id", plantIds);
  const ownedIds = (owned ?? []).map((r) => (r as { id: string }).id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ error: "No matching plants" }, { status: 404 });
  }

  const admin = createAdminClient();
  const note = action === "water" ? "Watered" : "Fertilized";
  const rows = ownedIds.map((id) => ({
    plant_id: id,
    event_type: action,
    note,
    metadata: {},
  }));
  const { error: insErr } = await admin.from("growth_logs").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Best-effort and parallel; the logs are saved regardless.
  await recalculateManyPlantScores(admin, ownedIds);

  return NextResponse.json({ ok: true, completed: ownedIds });
}
