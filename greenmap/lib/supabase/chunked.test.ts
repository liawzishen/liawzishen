import { describe, expect, it, vi } from "vitest";
import { ID_FILTER_CHUNK, selectInChunks } from "./chunked";

describe("selectInChunks", () => {
  it("runs no query for an empty id list", async () => {
    const run = vi.fn();
    expect(await selectInChunks([], run)).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it("splits long id lists and returns every row", async () => {
    const ids = Array.from({ length: ID_FILTER_CHUNK * 2 + 5 }, (_, i) => `id-${i}`);
    const run = vi.fn(async (part: string[]) => ({ data: part.map((id) => ({ id })) }));

    const rows = await selectInChunks(ids, run);

    expect(run).toHaveBeenCalledTimes(3);
    for (const [part] of run.mock.calls) expect(part.length).toBeLessThanOrEqual(ID_FILTER_CHUNK);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });

  it("treats a failed chunk (null data) as no rows", async () => {
    const run = vi.fn(async () => ({ data: null }));
    expect(await selectInChunks(["a"], run)).toEqual([]);
  });
});
