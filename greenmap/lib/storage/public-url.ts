/**
 * Checks that a URL points at a file in one of THIS project's public Supabase
 * Storage buckets.
 *
 * Why it matters: some routes fetch an image URL sent by the browser. Without
 * this check a signed-in user could make the server request any address
 * (server-side request forgery). Only our own storage is allowed.
 *
 * Pure function — the Supabase URL is injectable so it can be unit tested.
 */
export function publicStorageUrl(
  value: unknown,
  bucket: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): URL | null {
  if (typeof value !== "string" || !supabaseUrl) return null;

  let target: URL;
  let base: URL;
  try {
    target = new URL(value);
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }

  // `new URL()` already resolves "../" segments, so a prefix check on the
  // normalised pathname cannot be escaped with path tricks.
  const prefix = `/storage/v1/object/public/${bucket}/`;
  const insideBucket =
    target.pathname.startsWith(prefix) && target.pathname.length > prefix.length;

  if (target.origin !== base.origin || !insideBucket) return null;
  if (target.username || target.password) return null;
  return target;
}

/** Boolean form of {@link publicStorageUrl}. */
export function isPublicStorageUrl(
  value: unknown,
  bucket: string,
  supabaseUrl?: string
): value is string {
  return publicStorageUrl(value, bucket, supabaseUrl) !== null;
}
