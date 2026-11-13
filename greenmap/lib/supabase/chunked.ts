import { chunk } from "@/lib/utils";

/**
 * PostgREST sends `.in()` filters in the URL (`id=in.(…)`), so a long id list
 * can exceed URL length limits. Lists are split into pieces of this size.
 */
export const ID_FILTER_CHUNK = 100;

/**
 * Run one `.in()` query per chunk of `ids` (in parallel) and return all rows
 * together. A failed chunk contributes no rows — callers already treat missing
 * data as "nothing to show".
 *
 *   const rows = await selectInChunks(ids, (part) =>
 *     supabase.from("plants").select("id").in("id", part)
 *   );
 */
export async function selectInChunks<Row>(
  ids: readonly string[],
  run: (part: string[]) => PromiseLike<{ data: Row[] | null }>
): Promise<Row[]> {
  if (ids.length === 0) return [];
  const pages = await Promise.all(chunk(ids, ID_FILTER_CHUNK).map((part) => run(part)));
  return pages.flatMap((page) => page.data ?? []);
}
