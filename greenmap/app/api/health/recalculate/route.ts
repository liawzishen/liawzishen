import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculatePlantScore } from "@/lib/health/recalculate";

/**
 * POST /api/health/recalculate  { plantId }
 * Verifies ownership, then recomputes + persists the score and a history
 * snapshot via the shared recalculatePlantScore() helper.
 */
export async function POST(req: Request) {
  let plantId: string | undefined;
  try {
    plantId = (await req.json())?.plantId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!plantId) {
    return NextResponse.json({ error: "plantId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: plant } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .single();
  if (!plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  try {
    const score = await recalculatePlantScore(createAdminClient(), plantId);
    return NextResponse.json({ score });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recalculation failed" },
      { status: 500 }
    );
  }
}
