import { describe, expect, it, vi } from "vitest";
import {
  cleanIdList,
  cleanText,
  isCrossSiteRequest,
  isUuid,
  jsonError,
  readJsonObject,
  serverError,
  tooManyRequests,
} from "./http";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/test", { method: "POST", body, headers });

const A = "0b9f6a52-5d0e-4a39-9d3b-1c6f1f0f2a11";
const B = "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const C = "11111111-2222-4333-8444-555555555555";

describe("readJsonObject", () => {
  it("returns the parsed object", async () => {
    expect(await readJsonObject(post('{"plantId":"p1"}'))).toEqual({ plantId: "p1" });
  });

  it("returns null for invalid JSON and for non-objects", async () => {
    for (const bad of ["", "{oops", "null", "[1,2]", '"text"', "42"]) {
      expect(await readJsonObject(post(bad))).toBeNull();
    }
  });

  it("refuses a body larger than the limit", async () => {
    const big = JSON.stringify({ note: "x".repeat(500) });
    expect(await readJsonObject(post(big), 100)).toBeNull();
    expect(await readJsonObject(post(big), 1000)).toEqual({ note: "x".repeat(500) });
    // A declared size over the limit is refused without reading the body.
    expect(await readJsonObject(post("{}", { "content-length": "999999" }), 100)).toBeNull();
  });
});

describe("isCrossSiteRequest", () => {
  it("accepts requests from the app's own pages", () => {
    expect(isCrossSiteRequest(post("{}", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(
      isCrossSiteRequest(post("{}", { origin: "https://app.example", host: "app.example" }))
    ).toBe(false);
    expect(
      isCrossSiteRequest(
        post("{}", { origin: "https://app.example", host: "10.0.0.5:3000", "x-forwarded-host": "app.example" })
      )
    ).toBe(false);
  });

  it("refuses requests sent by a page on another site", () => {
    expect(isCrossSiteRequest(post("{}", { "sec-fetch-site": "cross-site" }))).toBe(true);
    // A sibling subdomain is another origin too.
    expect(isCrossSiteRequest(post("{}", { "sec-fetch-site": "same-site" }))).toBe(true);
    expect(
      isCrossSiteRequest(post("{}", { origin: "https://evil.example", host: "app.example" }))
    ).toBe(true);
    expect(isCrossSiteRequest(post("{}", { origin: "null", host: "app.example" }))).toBe(true);
  });

  it("trusts the browser's own header over a matching Origin", () => {
    expect(
      isCrossSiteRequest(
        post("{}", { "sec-fetch-site": "cross-site", origin: "https://app.example", host: "app.example" })
      )
    ).toBe(true);
  });

  it("lets non-browser clients through (they carry no ambient cookie)", () => {
    expect(isCrossSiteRequest(post("{}"))).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts database ids in either letter case", () => {
    expect(isUuid(A)).toBe(true);
    expect(isUuid(A.toUpperCase())).toBe(true);
  });

  it("rejects everything else", () => {
    for (const bad of ["", "p1", A + "0", A.slice(1), `${A},${B}`, `"${A}"`, 42, null, undefined, {}]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("cleanText", () => {
  it("trims, collapses whitespace and line breaks, and caps the length", () => {
    expect(cleanText("  cherry \n\n tomato\t ", 60)).toBe("cherry tomato");
    expect(cleanText("x".repeat(100), 10)).toBe("x".repeat(10));
  });

  it("returns an empty string for anything that is not a string", () => {
    for (const bad of [null, undefined, 5, {}, ["a"]]) expect(cleanText(bad, 10)).toBe("");
  });
});

describe("cleanIdList", () => {
  it("keeps unique database ids in order", () => {
    expect(cleanIdList([A, B, A, 3, null, "", C], 10)).toEqual([A, B, C]);
  });

  it("treats the same id in another letter case as one id", () => {
    expect(cleanIdList([A, A.toUpperCase()], 10)).toEqual([A]);
  });

  it("drops anything that is not an id (filter-injection attempts included)", () => {
    expect(cleanIdList(["a", `${A},${B}`, `${A}"`, "x".repeat(65), ")or(1=1"], 10)).toEqual([]);
  });

  it("caps the list", () => {
    expect(cleanIdList([A, B, C], 2)).toEqual([A, B]);
  });

  it("returns an empty list for non-arrays", () => {
    expect(cleanIdList(`${A},${B}`, 10)).toEqual([]);
    expect(cleanIdList(undefined, 10)).toEqual([]);
  });
});

describe("error responses", () => {
  it("jsonError sends { error } with the status and extra fields", async () => {
    const res = jsonError("No scan credits left", 402, { code: "out_of_credits" });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "No scan credits left", code: "out_of_credits" });
  });

  it("tooManyRequests tells the client when to try again", async () => {
    const res = tooManyRequests(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(await res.json()).toMatchObject({ code: "rate_limited", retryAfter: 42 });
  });

  it("serverError logs the cause but never sends it to the client", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError("/api/test", new Error('relation "secret_table" does not exist'), "Could not save.");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret_table");
    expect(log).toHaveBeenCalledOnce();
  });
});
