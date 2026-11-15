import { describe, expect, it } from "vitest";
import { SSO_ERRORS, ssoErrorCode, ssoErrorMessage } from "./sso-errors";

describe("ssoErrorMessage", () => {
  it("has nothing to show when the URL carries no error", () => {
    expect(ssoErrorMessage(null)).toBeNull();
  });

  it("maps the known codes to their fixed messages", () => {
    expect(ssoErrorMessage("cancelled")).toBe(SSO_ERRORS.cancelled);
    expect(ssoErrorMessage("failed")).toBe(SSO_ERRORS.failed);
  });

  it("never shows text taken from the URL", () => {
    for (const crafted of [
      "Your account is locked. Call +60 12-345 6789",
      "<img src=x onerror=alert(1)>",
      "constructor",
      "__proto__",
      "",
    ]) {
      expect(ssoErrorMessage(crafted)).toBe(SSO_ERRORS.failed);
    }
  });
});

describe("ssoErrorCode", () => {
  it("treats a refused consent screen as a cancel, everything else as a failure", () => {
    expect(ssoErrorCode("access_denied")).toBe("cancelled");
    expect(ssoErrorCode("server_error")).toBe("failed");
    expect(ssoErrorCode(null)).toBe("failed");
  });
});
