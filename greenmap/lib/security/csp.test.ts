import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

const SUPABASE = "https://abc123.supabase.co";

/** Parse a policy into { directive: [sources] }. */
function parse(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split("; ").map((part) => {
      const [name, ...sources] = part.split(" ");
      return [name, sources];
    })
  );
}

describe("buildCsp (production)", () => {
  const csp = parse(buildCsp({ nonce: "N0NCE", supabaseUrl: SUPABASE, isDev: false }));

  it("only runs scripts that carry this response's nonce", () => {
    expect(csp["script-src"]).toContain("'nonce-N0NCE'");
    expect(csp["script-src"]).toContain("'strict-dynamic'");
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
  });

  it("lets the browser talk to this app and to Supabase, nothing else", () => {
    expect(csp["connect-src"]).toEqual([
      "'self'",
      "blob:",
      "https://abc123.supabase.co",
      "wss://abc123.supabase.co",
    ]);
  });

  it("closes the classic side doors", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'self'"]);
    expect(csp["frame-src"]).toEqual(["'none'"]);
  });
});

describe("buildCsp (other environments)", () => {
  it("adds what `next dev` needs, and only in development", () => {
    const dev = parse(buildCsp({ nonce: "n", supabaseUrl: SUPABASE, isDev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
  });

  it("supports a local Supabase over plain http", () => {
    const csp = parse(buildCsp({ nonce: "n", supabaseUrl: "http://localhost:54321", isDev: false }));
    expect(csp["connect-src"]).toContain("http://localhost:54321");
    expect(csp["connect-src"]).toContain("ws://localhost:54321");
  });

  it("still builds a valid policy when Supabase is not configured or malformed", () => {
    for (const supabaseUrl of [undefined, "", "not a url", "javascript:alert(1)"]) {
      const csp = parse(buildCsp({ nonce: "n", supabaseUrl, isDev: false }));
      expect(csp["connect-src"]).toEqual(["'self'", "blob:"]);
    }
  });

  it("cannot be broken out of by a hostile Supabase URL", () => {
    const policy = buildCsp({
      nonce: "n",
      supabaseUrl: "https://x.supabase.co/; script-src *",
      isDev: false,
    });
    expect(policy.match(/script-src/g)).toHaveLength(1);
    expect(parse(policy)["connect-src"]).toContain("https://x.supabase.co");
  });
});

describe("createNonce", () => {
  it("is 128 random bits in base64, different every time", () => {
    const nonces = new Set(Array.from({ length: 200 }, createNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
