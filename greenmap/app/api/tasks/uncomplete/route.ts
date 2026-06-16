import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculatePlantScore } from "@/lib/health/recalculate";

/**
 * POST /api/tasks/uncomplete  { action: "water" | "fertilize", plantIds: string[] }
 *
 * Undo a completed care task: deletes the most recent matching care log for
 * each owned plant (the one the complete action just created) and recalculates
 * the score. Powers the "uncheck" in the Completed Today tray.
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

  const { data: owned } = await supabase
    .from("plants")
    .select("id")
    .in("id", plantIds);
  const ownedIds = (owned ?? []).map((r) => (r as { id: string }).id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ error: "No matching plants" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: logs } = await admin
    .from("growth_logs")
    .select("id, plant_id, created_at")
    .in("plant_id", ownedIds)
    .eq("event_type", action)
    .order("created_at", { ascending: false });

  const latestId = new Map<string, string>();
  for (const l of logs ?? []) {
    if (!latestId.has(l.plant_id)) latestId.set(l.plant_id, l.id);
  }
  const ids = [...latestId.values()];
  if (ids.length > 0) {
    const { error } = await admin.from("growth_logs").delete().in("id", ids);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  for (const id of latestId.keys()) {
    try {
      await recalculatePlantScore(admin, id);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true });
}
