import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListing } from "@/components/sales/demo-listings";
import { ownsSellerName } from "@/lib/marketplace/seller";
import { guardRequest } from "@/lib/api/guard";
import { cleanText, jsonError, serverError } from "@/lib/api/http";
import { LIMITS } from "@/lib/api/rate-limit";

const SCOPE = "/api/listings/stock";
const FAILED = "Could not update the stock. Please try again.";

/**
 * POST /api/listings/stock  { listingId, inStock }
 *
 * A seller switches one of THEIR listings in or out of stock.
 *
 * This used to be a direct database write from the browser. The database
 * cannot know which farm a (demo) listing belongs to, so the first account
 * to write a row for a listing owned it — any grower could mark a
 * competitor's listing "out of stock". Now the server checks that the caller
 * is the seller of the listing's farm, and only the server writes the table.
 */
export async function POST(req: Request) {
  const guard = await guardRequest(req, { limit: LIMITS.write });
  if (!guard.ok) return guard.response;
  const { supabase, body } = guard;

  const listing = getListing(cleanText(body.listingId, 64));
  if (!listing) return jsonError("Unknown listing", 404);
  if (typeof body.inStock !== "boolean") {
    return jsonError("inStock must be true or false", 400);
  }

  try {
    if (!(await ownsSellerName(supabase, listing.farm))) {
      return jsonError("This listing belongs to another farm", 403);
    }

    const { error } = await createAdminClient().from("listing_stock").upsert(
      {
        listing_id: listing.id,
        // Always the listing's real farm — repairs a row claimed under
        // another name before this check existed.
        seller_farm: listing.farm,
        in_stock: body.inStock,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id" }
    );
    if (error) return serverError(SCOPE, error, FAILED);

    return NextResponse.json({ ok: true, listingId: listing.id, inStock: body.inStock });
  } catch (e) {
    return serverError(SCOPE, e, FAILED);
  }
}
