/** Tiny class-name combiner (no external deps). */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Split an array into consecutive pieces of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

/**
 * Run `fn` over `items` with at most `batchSize` calls in flight at once, so a
 * large batch cannot open hundreds of database requests together.
 */
export async function mapInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const group of chunk(items, batchSize)) {
    results.push(...(await Promise.all(group.map(fn))));
  }
  return results;
}
