/*
 * Messages for a failed Google / Apple sign-in.
 *
 * /auth/callback sends the sign-in page a short CODE (`?sso_error=cancelled`),
 * never a sentence. The page used to show whatever text was in the address
 * bar, so a crafted link could put any message on the real sign-in page
 * ("Your account is locked, call this number…"). Now only these fixed
 * messages can ever appear.
 */

export const SSO_ERRORS = {
  cancelled: "Sign-in was cancelled. Please try again.",
  failed: "Could not complete sign-in. Please try again.",
} as const;

export type SsoErrorCode = keyof typeof SSO_ERRORS;

/** The message for a code from the URL. Anything unknown gets the general one. */
export function ssoErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return Object.hasOwn(SSO_ERRORS, code)
    ? SSO_ERRORS[code as SsoErrorCode]
    : SSO_ERRORS.failed;
}

/** Which code fits what the sign-in provider reported. */
export function ssoErrorCode(providerError: string | null): SsoErrorCode {
  return providerError === "access_denied" ? "cancelled" : "failed";
}
