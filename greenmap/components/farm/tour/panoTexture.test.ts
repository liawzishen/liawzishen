import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPanoBlob } from "./panoTexture";

const photo = () => new Response(new Blob(["jpeg-bytes"]), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPanoBlob", () => {
  it("shares one request between a prefetch and a hop for the same photo", async () => {
    const fetchMock = vi.fn(async () => photo());
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      fetchPanoBlob("/demo/pano-1.jpg"),
      fetchPanoBlob("/demo/pano-1.jpg"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("uses separate requests for different photos", async () => {
    const fetchMock = vi.fn(async () => photo());
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([fetchPanoBlob("/a.jpg"), fetchPanoBlob("/b.jpg")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("asks again once the first request has finished (the HTTP cache answers)", async () => {
    const fetchMock = vi.fn(async () => photo());
    vi.stubGlobal("fetch", fetchMock);
    await fetchPanoBlob("/c.jpg");
    await fetchPanoBlob("/c.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects on an HTTP error and lets the next attempt retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("gone", { status: 404 }))
      .mockResolvedValueOnce(photo());
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPanoBlob("/d.jpg")).rejects.toThrow(/404/);
    await expect(fetchPanoBlob("/d.jpg")).resolves.toBeInstanceOf(Blob);
  });

  it("rejects on a network failure and lets the next attempt retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(photo());
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPanoBlob("/e.jpg")).rejects.toThrow(/Failed to fetch/);
    await expect(fetchPanoBlob("/e.jpg")).resolves.toBeInstanceOf(Blob);
  });
});
