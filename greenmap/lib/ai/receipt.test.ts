import { describe, expect, it } from "vitest";
import { RECEIPT_TTL_MS, signScan, verifyScan, type ScanClaim } from "./receipt";

const SECRET = "test-service-role-key";
const NOW = 1_800_000_000_000;

const claim: ScanClaim = {
  userId: "user-1",
  plantId: "plant-1",
  imageUrl: "https://x.supabase.co/storage/v1/object/public/plant-scans/plant-1/1.jpg",
  result: {
    diagnosis: "Early blight on lower leaves",
    severity: "moderate",
    confidence: 82,
    ai_sub_score: 50,
    recommendations: ["Remove affected leaves", "Avoid overhead watering"],
  },
};

const sign = (c: ScanClaim = claim) => signScan(c, NOW, SECRET) as string;
const verify = (c: ScanClaim, receipt: unknown, now = NOW) => verifyScan(c, receipt, now, SECRET);

describe("scan receipts", () => {
  it("accepts the result exactly as the server produced it", () => {
    expect(verify(claim, sign())).toBe(true);
  });

  it("still accepts it after the browser's JSON round trip (extra fields, mock flag)", () => {
    const echoed = { ...(claim.result as object), mock: true, extra: "ignored" };
    expect(verify({ ...claim, result: echoed }, sign())).toBe(true);
  });

  it("refuses a result that was edited in the browser", () => {
    const edits: Record<string, unknown>[] = [
      { severity: "none" },
      { diagnosis: "Perfectly healthy" },
      { confidence: 100 },
      { recommendations: ["Nothing to do"] },
    ];
    for (const edit of edits) {
      const result = { ...(claim.result as object), ...edit };
      expect(verify({ ...claim, result }, sign()), JSON.stringify(edit)).toBe(false);
    }
  });

  it("refuses a receipt used for another plant, photo or user", () => {
    expect(verify({ ...claim, plantId: "plant-2" }, sign())).toBe(false);
    expect(verify({ ...claim, imageUrl: claim.imageUrl + "x" }, sign())).toBe(false);
    expect(verify({ ...claim, userId: "user-2" }, sign())).toBe(false);
  });

  it("expires after two hours", () => {
    expect(verify(claim, sign(), NOW + RECEIPT_TTL_MS - 1)).toBe(true);
    expect(verify(claim, sign(), NOW + RECEIPT_TTL_MS + 1)).toBe(false);
  });

  it("refuses a receipt whose expiry was pushed into the future", () => {
    const [, signature] = sign().split(".");
    expect(verify(claim, `${NOW + 10 * RECEIPT_TTL_MS}.${signature}`)).toBe(false);
  });

  it("refuses made-up and malformed receipts", () => {
    for (const bad of [null, undefined, "", "abc", ".", `${NOW + 1000}.`, `${NOW + 1000}.AAAA`, 42, {}, "x".repeat(500)]) {
      expect(verify(claim, bad)).toBe(false);
    }
  });

  it("refuses a receipt signed with another key", () => {
    expect(verifyScan(claim, signScan(claim, NOW, "other-key"), NOW, SECRET)).toBe(false);
  });

  it("issues and accepts nothing when no secret is configured", () => {
    expect(signScan(claim, NOW, "")).toBeNull();
    expect(verifyScan(claim, sign(), NOW, "")).toBe(false);
  });
});
