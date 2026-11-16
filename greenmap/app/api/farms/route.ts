import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_FARMS_PER_USER } from "@/lib/farm/options";
import { parseNewFarm } from "@/lib/farm/validate";
import { createFarm } from "@/lib/farm/write";
import { guardRequest } from "@/lib/api/guard";
import { jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/farms";
const FAILED = "Could not create the farm. Please try again.";

/**
 * POST /api/farms  { name, location, size, cropType, backgroundType,
 *                    backgroundUrl?, latitude?, longitude?, zones: [{ name, color }] }
 *
 * The last step of the setup wizard: creates the farm and its zones in one
 * request, all or nothing. The farm always belongs to the signed-in user —
 * the request cannot name another owner.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, user, body } = guard;

  const farm = parseNewFarm(body);
  if (!farm.ok) return jsonError(farm.error, 400);

  try {
    // Counted through the user's own eyes: Row Level Security returns only
    // their farms.
    const { count, error } = await supabase
      .from("farms")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    if ((count ?? 0) >= MAX_FARMS_PER_USER) {
      return jsonError(`An account can have at most ${MAX_FARMS_PER_USER} farms.`, 409, {
        code: "farm_limit",
      });
    }

    const id = await createFarm(createAdminClient(), user.id, farm.value);
    return NextResponse.json({ farm: { id } }, { status: 201 });
  } catch (e) {
    return serverError(SCOPE, e, FAILED);
  }
}
