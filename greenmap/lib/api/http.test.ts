import { describe, expect, it, vi } from "vitest";
import { cleanIdList, cleanText, jsonError, readJsonObject, serverError } from "./http";

const post = (body: string) =>
  new Request("http://localhost/api/test", { method: "POST", body });

describe("readJsonObject", () => {
  it("returns the parsed object", async () => {
    expect(await readJsonObject(post('{"plantId":"p1"}'))).toEqual({ plantId: "p1" });
  });

  it("returns null for invalid JSON and for non-objects", async () => {
    for (const bad of ["", "{oops", "null", "[1,2]", '"text"', "42"]) {
      expect(await readJsonObject(post(bad))).toBeNull();
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
  it("keeps unique string ids in order", () => {
    expect(cleanIdList(["a", "b", "a", 3, null, "", "c"], 10)).toEqual(["a", "b", "c"]);
  });

  it("caps the list and ignores oversized values", () => {
    expect(cleanIdList(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(cleanIdList(["x".repeat(65)], 10)).toEqual([]);
  });

  it("returns an empty list for non-arrays", () => {
    expect(cleanIdList("a,b", 10)).toEqual([]);
    expect(cleanIdList(undefined, 10)).toEqual([]);
  });
});

describe("error responses", () => {
  it("jsonError sends { error } with the status and extra fields", async () => {
    const res = jsonError("No scan credits left", 402, { code: "out_of_credits" });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "No scan credits left", code: "out_of_credits" });
  });

  it("serverError logs the cause but never sends it to the client", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError("/api/test", new Error('relation "secret_table" does not exist'), "Could not save.");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret_table");
    expect(log).toHaveBeenCalledOnce();
  });
});
