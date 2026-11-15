/*
 * Content-Security-Policy: the list of places the browser may load things
 * from, sent with every page.
 *
 * Why: React escapes text, so the app has no known way to inject a script.
 * A CSP is the second lock — if such a hole ever appears (a library bug, a
 * careless `dangerouslySetInnerHTML`), the injected script still does not
 * run, because it does not carry this response's one-time number (the nonce).
 *
 * Pure function: the middleware supplies the nonce and the environment.
 */

export interface CspInput {
  /** One-time random value for this response. */
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL — the only outside API the browser calls. */
  supabaseUrl: string | undefined;
  /** `next dev` needs eval (fast refresh) and a websocket (hot reload). */
  isDev: boolean;
}

/** The Supabase project's http(s) origin and its websocket twin, if configured. */
function supabaseSources(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  try {
    const { protocol, host } = new URL(supabaseUrl);
    if (protocol !== "https:" && protocol !== "http:") return [];
    return [`${protocol}//${host}`, `${protocol === "http:" ? "ws:" : "wss:"}//${host}`];
  } catch {
    return [];
  }
}

export function buildCsp({ nonce, supabaseUrl, isDev }: CspInput): string {
  const supabase = supabaseSources(supabaseUrl);

  const directives: Record<string, string[]> = {
    // Anything not listed below: our own origin only.
    "default-src": ["'self'"],
    // Scripts need this response's nonce. 'strict-dynamic' lets a trusted
    // script load the page's other chunks; no host and no inline script is
    // trusted on its own.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // React writes `style="…"` attributes into the HTML it sends, and those
    // cannot carry a nonce — so inline styles stay allowed. Styles cannot
    // run code; scripts are what this policy is about.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Photos live in Supabase Storage; previews are blob:/data: URLs. Other
    // https images are allowed too (a Google profile photo after sign-in).
    "img-src": ["'self'", "data:", "blob:", "https:", ...supabase.slice(0, 1)],
    "font-src": ["'self'", "data:"],
    // fetch / websocket targets: us and Supabase. blob: for photos the
    // browser re-reads from memory before an upload.
    "connect-src": ["'self'", "blob:", ...supabase, ...(isDev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "frame-src": ["'none'"],
    // Nobody else may put GreenMap in a frame (clickjacking).
    "frame-ancestors": ["'self'"],
    // A stray <base> tag must not be able to re-point every relative URL.
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/** A fresh nonce: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
