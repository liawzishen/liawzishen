import { describe, expect, it } from "vitest";
import { qrMatrix } from "./qr";

const URL = "https://greenmap.example/passport/0b9f6a52-5d0e-4a39-9d3b-1c6f1f0f2a11";

/** Rebuild the dark/light grid from the SVG path, to check it against the spec. */
function gridFromPath(path: string, viewBox: number): boolean[][] {
  const grid = Array.from({ length: viewBox }, () => Array<boolean>(viewBox).fill(false));
  for (const [, x, y, w] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) grid[Number(y)][Number(x) + i] = true;
  }
  return grid;
}

describe("qrMatrix", () => {
  const qr = qrMatrix(URL);
  const grid = gridFromPath(qr.path, qr.viewBox);

  it("leaves the 4-module quiet zone the QR standard requires", () => {
    expect(qr.viewBox).toBe(qr.size + 8);
    for (let i = 0; i < qr.viewBox; i++) {
      for (const edge of [0, 1, 2, 3, qr.viewBox - 1, qr.viewBox - 4]) {
        expect(grid[edge][i]).toBe(false);
        expect(grid[i][edge]).toBe(false);
      }
    }
  });

  it("draws the three finder patterns (the big corner squares)", () => {
    // A finder is 7×7: dark ring, light ring, dark 3×3 centre.
    const finderAt = (top: number, left: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          expect(grid[top + r][left + c], `module ${r},${c}`).toBe(ring !== 2);
        }
      }
    };
    finderAt(4, 4);
    finderAt(4, 4 + qr.size - 7);
    finderAt(4 + qr.size - 7, 4);
  });

  it("is the same every time, and different for another link", () => {
    expect(qrMatrix(URL).path).toBe(qr.path);
    expect(qrMatrix(URL + "x").path).not.toBe(qr.path);
  });

  it("uses a valid QR size (21 + 4n modules)", () => {
    expect((qr.size - 21) % 4).toBe(0);
    expect(qr.size).toBeGreaterThanOrEqual(21);
  });
});
