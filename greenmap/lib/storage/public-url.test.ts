import { describe, expect, it } from "vitest";
import { isPublicStorageUrl, publicStorageUrl } from "./public-url";

const SUPABASE = "https://abc123.supabase.co";
const ok = `${SUPABASE}/storage/v1/object/public/plant-scans/plant-1/170000.jpg`;
const check = (url: unknown) => isPublicStorageUrl(url, "plant-scans", SUPABASE);

describe("publicStorageUrl", () => {
  it("accepts a file in the expected public bucket", () => {
    expect(check(ok)).toBe(true);
    expect(publicStorageUrl(ok, "plant-scans", SUPABASE)?.href).toBe(ok);
  });

  it("rejects other hosts (server-side request forgery)", () => {
    expect(check("https://evil.example/storage/v1/object/public/plant-scans/a.jpg")).toBe(false);
    expect(check("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(check("http://localhost:3000/api/health/recalculate")).toBe(false);
    expect(check(`${SUPABASE}.evil.example/storage/v1/object/public/plant-scans/a.jpg`)).toBe(false);
  });

  it("rejects a different scheme or port on the same host", () => {
    expect(check(ok.replace("https://", "http://"))).toBe(false);
    expect(check(ok.replace(".co/", ".co:8443/"))).toBe(false);
  });

  it("rejects other buckets and non-public paths", () => {
    expect(check(`${SUPABASE}/storage/v1/object/public/avatars/a.jpg`)).toBe(false);
    expect(check(`${SUPABASE}/storage/v1/object/sign/plant-scans/a.jpg`)).toBe(false);
    expect(check(`${SUPABASE}/rest/v1/profiles`)).toBe(false);
    expect(check(`${SUPABASE}/storage/v1/object/public/plant-scans/`)).toBe(false);
  });

  it("rejects path tricks that climb out of the bucket", () => {
    const base = `${SUPABASE}/storage/v1/object/public/plant-scans`;
    expect(check(`${base}/../avatars/a.jpg`)).toBe(false);
    expect(check(`${base}/../../../../rest/v1/profiles`)).toBe(false);
    expect(check(`${base}/%2e%2e/%2e%2e/admin`)).toBe(false);
  });

  it("rejects credentials in the URL and non-URL input", () => {
    expect(check(ok.replace("https://", "https://user:pass@"))).toBe(false);
    for (const bad of ["", "not a url", "javascript:alert(1)", "file:///etc/passwd", null, 42, {}]) {
      expect(check(bad)).toBe(false);
    }
  });

  it("rejects everything when the Supabase URL is not configured", () => {
    expect(isPublicStorageUrl(ok, "plant-scans", "")).toBe(false);
  });
});
