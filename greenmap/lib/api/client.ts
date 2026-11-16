/*
 * Calling our own API from the browser.
 *
 * Every call site used to repeat the same fetch, JSON and error handling.
 * `postJson` does it once and always answers with one of two shapes, so a
 * component never needs a try/catch around a request.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** HTTP status, or 0 when the request never reached the server. */
      status: number;
      /** A message that can be shown to the user as it is. */
      error: string;
    };

const OFFLINE = "No connection. Check your internet and try again.";
const UNKNOWN = "Something went wrong. Please try again.";

/** POST a JSON body to one of the app's API routes. Never throws. */
export async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error;
    return {
      ok: false,
      status: res.status,
      error: typeof message === "string" && message ? message : UNKNOWN,
    };
  }
  return { ok: true, data: data as T };
}
