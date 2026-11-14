import { describe, expect, it } from "vitest";
import { displayName, userFromClaims } from "./claims";

const claims = {
  sub: "11111111-1111-4111-8111-111111111111",
  role: "authenticated",
  email: "ahmad@example.com",
  user_metadata: { name: "Ahmad", role: "grower" },
};

describe("userFromClaims", () => {
  it("reads the id, email and metadata of a signed-in user", () => {
    expect(userFromClaims(claims)).toEqual({
      id: claims.sub,
      email: "ahmad@example.com",
      metadata: { name: "Ahmad", role: "grower" },
    });
  });

  it("returns null when there are no claims", () => {
    expect(userFromClaims(null)).toBeNull();
    expect(userFromClaims(undefined)).toBeNull();
    expect(userFromClaims("token")).toBeNull();
  });

  it("returns null without a user id", () => {
    expect(userFromClaims({ ...claims, sub: "" })).toBeNull();
    expect(userFromClaims({ ...claims, sub: 42 })).toBeNull();
  });

  it("does not treat the anon or service-role API keys as a user", () => {
    expect(userFromClaims({ ...claims, role: "anon" })).toBeNull();
    expect(userFromClaims({ ...claims, role: "service_role" })).toBeNull();
    expect(userFromClaims({ sub: claims.sub })).toBeNull();
  });

  it("tolerates missing or malformed optional claims", () => {
    expect(
      userFromClaims({ sub: claims.sub, role: "authenticated", user_metadata: "x" })
    ).toEqual({ id: claims.sub, email: null, metadata: {} });
  });
});

describe("displayName", () => {
  it("uses the trimmed name from the metadata", () => {
    const user = userFromClaims({ ...claims, user_metadata: { name: "  Siti  " } });
    expect(displayName(user, "there")).toBe("Siti");
  });

  it("falls back when the name is missing, blank or not text", () => {
    expect(displayName(null, "there")).toBe("there");
    expect(displayName(userFromClaims({ ...claims, user_metadata: { name: "  " } }), "x")).toBe("x");
    expect(displayName(userFromClaims({ ...claims, user_metadata: { name: 7 } }), "x")).toBe("x");
  });
});
