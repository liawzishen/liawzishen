import { describe, expect, it } from "vitest";
import { parseNewFarm } from "./validate";

const SUPABASE = "https://abc123.supabase.co";
const PHOTO = `${SUPABASE}/storage/v1/object/public/farm-backgrounds/user-1/170000.jpg`;

const good = {
  name: "  Ladang   Hijau ",
  location: "Johor",
  size: "medium",
  cropType: "Tomato",
  backgroundType: "smart",
  backgroundUrl: null,
  latitude: null,
  longitude: null,
  zones: [{ name: "North Plot", color: "#34c759" }],
};
const parse = (patch: Record<string, unknown> = {}) => parseNewFarm({ ...good, ...patch }, SUPABASE);
const error = (patch: Record<string, unknown>) => {
  const result = parse(patch);
  return result.ok ? null : result.error;
};

describe("parseNewFarm", () => {
  it("accepts the wizard's data and tidies the text", () => {
    const result = parse();
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ladang Hijau",
        location: "Johor",
        size: "medium",
        cropType: "Tomato",
        backgroundType: "smart",
        backgroundUrl: null,
        pin: null,
        zones: [{ name: "North Plot", color: "#34C759" }],
      },
    });
  });

  it("needs a name and a crop of a sensible length", () => {
    expect(error({ name: "A" })).toMatch(/farm name/);
    expect(error({ name: "x".repeat(61) })).toMatch(/farm name/);
    expect(error({ name: 42 })).toMatch(/farm name/);
    expect(error({ cropType: "" })).toMatch(/main crop/);
    expect(error({ cropType: "x".repeat(41) })).toMatch(/main crop/);
  });

  it("only accepts the listed states, sizes and backgrounds", () => {
    expect(error({ location: "Atlantis" })).toMatch(/state/);
    expect(error({ location: "johor" })).toMatch(/state/);
    expect(error({ size: "huge" })).toMatch(/size/);
    expect(error({ backgroundType: "video" })).toMatch(/background/);
  });

  it("only accepts a background photo from our own storage", () => {
    const ok = parse({ backgroundType: "upload", backgroundUrl: PHOTO });
    expect(ok.ok && ok.value.backgroundUrl).toBe(PHOTO);
    for (const bad of [
      "https://evil.example/pixel.gif",
      "javascript:alert(1)",
      `${SUPABASE}/storage/v1/object/public/plant-scans/x.jpg`, // another bucket
      "/demo/local.jpg",
      42,
    ]) {
      expect(error({ backgroundType: "upload", backgroundUrl: bad }), String(bad)).toMatch(/photo uploaded/);
    }
  });

  it("drops a leftover photo when the smart background is chosen", () => {
    const result = parse({ backgroundType: "smart", backgroundUrl: "https://evil.example/x.gif" });
    expect(result.ok && result.value.backgroundUrl).toBeNull();
  });

  it("allows a satellite or upload background that has no photo yet", () => {
    const result = parse({ backgroundType: "satellite", backgroundUrl: null });
    expect(result.ok && result.value.backgroundUrl).toBeNull();
  });

  it("takes a GPS pin only as two real numbers in range", () => {
    const pinned = parse({ latitude: 1.4927, longitude: 103.7414 });
    expect(pinned.ok && pinned.value.pin).toEqual({ latitude: 1.4927, longitude: 103.7414 });
    for (const bad of [
      { latitude: 1.49 }, // half a pin
      { latitude: "1.49", longitude: "103.7" },
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      { latitude: NaN, longitude: 0 },
    ]) {
      expect(error(bad), JSON.stringify(bad)).toMatch(/GPS/);
    }
  });

  it("limits the zones and checks each one", () => {
    const zone = { name: "Zone", color: "#FF9F0A" };
    expect(parse({ zones: [] }).ok).toBe(true);
    expect(parse({ zones: undefined }).ok).toBe(true);
    expect(parse({ zones: Array(8).fill(zone) }).ok).toBe(true);
    expect(error({ zones: Array(9).fill(zone) })).toMatch(/at most 8 zones/);
    expect(error({ zones: "North" })).toMatch(/zones/);
    expect(error({ zones: [{ name: "", color: "#FF9F0A" }] })).toMatch(/zone name/);
    expect(error({ zones: [{ name: "x".repeat(41), color: "#FF9F0A" }] })).toMatch(/zone name/);
    for (const color of ["red", "#FFF", "#GGGGGG", "url(https://evil.example)", 7, undefined]) {
      expect(error({ zones: [{ name: "Zone", color }] }), String(color)).toMatch(/colour/);
    }
    expect(error({ zones: [null] })).toMatch(/zone name/);
  });

  it("never lets the request choose the owner", () => {
    const result = parse({ user_id: "someone-else", userId: "someone-else" });
    expect(result.ok && Object.keys(result.value)).not.toContain("user_id");
    expect(result.ok && Object.keys(result.value)).not.toContain("userId");
  });
});
