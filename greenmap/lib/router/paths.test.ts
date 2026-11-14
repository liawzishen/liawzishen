import { describe, expect, it } from "vitest";
import { inAppLinkTarget, tabMatches } from "./paths";

const here = { origin: "https://app.test", pathname: "/farms/1" };

/** A minimal stand-in for a DOM element: enough for `closest` and `contains`. */
interface FakeElement {
  tag: string;
  attrs: Record<string, string>;
  parent: FakeElement | null;
  href: string | undefined;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  closest(selector: string): FakeElement | null;
  contains(other: FakeElement | null): boolean;
}

function element(
  tag: string,
  attrs: Record<string, string> = {},
  parent: FakeElement | null = null
): FakeElement {
  const node: FakeElement = {
    tag,
    attrs,
    parent,
    href: attrs.href,
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => name in attrs,
    closest(selector) {
      const wanted = selector.split(",").map((s) => s.trim());
      for (let n: FakeElement | null = node; n; n = n.parent) {
        if (wanted.includes(n.tag)) return n;
        if (wanted.includes("a[href]") && n.tag === "a" && "href" in n.attrs) return n;
      }
      return null;
    },
    contains(other) {
      for (let n = other; n; n = n.parent) {
        if (n === node) return true;
      }
      return false;
    },
  };
  return node;
}

function click(target: unknown, extra: Partial<MouseEvent> = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: target as EventTarget,
    ...extra,
  };
}

describe("inAppLinkTarget", () => {
  it("returns the path of a plain same-site link", () => {
    const a = element("a", { href: "https://app.test/farms/1/field" });
    expect(inAppLinkTarget(click(a), here)).toBe("/farms/1/field");
  });

  it("works when the tap lands on something inside the link", () => {
    const a = element("a", { href: "/farms/1/sales" });
    const icon = element("svg", {}, a);
    expect(inAppLinkTarget(click(icon), here)).toBe("/farms/1/sales");
  });

  it("ignores taps that are not on a link", () => {
    expect(inAppLinkTarget(click(element("div")), here)).toBeNull();
    expect(inAppLinkTarget(click(null), here)).toBeNull();
  });

  it("ignores new-tab clicks (modifier keys, other mouse buttons, target)", () => {
    const a = element("a", { href: "/farms/1/field" });
    expect(inAppLinkTarget(click(a, { metaKey: true }), here)).toBeNull();
    expect(inAppLinkTarget(click(a, { ctrlKey: true }), here)).toBeNull();
    expect(inAppLinkTarget(click(a, { button: 1 }), here)).toBeNull();
    const blank = element("a", { href: "/farms/1/field", target: "_blank" });
    expect(inAppLinkTarget(click(blank), here)).toBeNull();
  });

  it("ignores downloads, other sites and non-web links", () => {
    expect(
      inAppLinkTarget(click(element("a", { href: "/report.pdf", download: "" })), here)
    ).toBeNull();
    expect(
      inAppLinkTarget(click(element("a", { href: "https://wa.me/?text=hi" })), here)
    ).toBeNull();
    expect(
      inAppLinkTarget(click(element("a", { href: "mailto:someone@example.com" })), here)
    ).toBeNull();
  });

  it("ignores links to the page we are already on", () => {
    expect(
      inAppLinkTarget(click(element("a", { href: "/farms/1?tab=x#top" })), here)
    ).toBeNull();
  });

  it("ignores a button that sits inside a link", () => {
    const a = element("a", { href: "/farms/1/plants/9" });
    const button = element("button", {}, a);
    expect(inAppLinkTarget(click(button), here)).toBeNull();
  });
});

describe("tabMatches", () => {
  it("matches an exact tab only on its own path", () => {
    const home = { href: "/farms/1", exact: true };
    expect(tabMatches("/farms/1", home)).toBe(true);
    expect(tabMatches("/farms/1/field", home)).toBe(false);
  });

  it("matches a section tab on its path and the pages under it", () => {
    const sales = { href: "/farms/1/sales", exact: false };
    expect(tabMatches("/farms/1/sales", sales)).toBe(true);
    expect(tabMatches("/farms/1/sales/market", sales)).toBe(true);
    expect(tabMatches("/farms/1/profile", sales)).toBe(false);
  });
});
