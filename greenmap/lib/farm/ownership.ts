import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/supabase/chunked";

/**
 * Which of `plantIds` the signed-in user owns. Pass the RLS-scoped client:
 * Row Level Security only returns the caller's own plants, so anything that
 * comes back is theirs.
 */
export async function ownedPlantIds(
  supabase: SupabaseClient,
  plantIds: string[]
): Promise<string[]> {
  const rows = await selectInChunks<{ id: string }>(plantIds, (part) =>
    supabase.from("plants").select("id").in("id", part)
  );
  return rows.map((row) => row.id);
}
