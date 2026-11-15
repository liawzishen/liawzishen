import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Who is the seller of a farm name?
 *
 * Marketplace listings are still demo data, so a listing knows its seller
 * only by farm NAME. Names are free text, so the database decides who owns
 * one: the farm that has held the name the longest (migration 0010,
 * `owns_seller_name`). A second account that copies a seller's farm name
 * gets nothing.
 */

/** PostgREST: "no function with this name" — 0010 is not applied yet. */
const FUNCTION_MISSING = new Set(["PGRST202", "42883"]);

/**
 * True when the signed-in user is the seller behind `farmName`.
 * Pass the Row Level Security client (the caller's own session).
 */
export async function ownsSellerName(
  supabase: SupabaseClient,
  farmName: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("owns_seller_name", { seller: farmName });
  if (!error) return data === true;
  if (!FUNCTION_MISSING.has(error.code ?? "")) throw error;

  // Before 0010: the old rule — any farm of yours with this name.
  const { data: farms, error: farmError } = await supabase
    .from("farms")
    .select("id")
    .eq("name", farmName)
    .limit(1);
  if (farmError) throw farmError;
  return (farms ?? []).length > 0;
}
