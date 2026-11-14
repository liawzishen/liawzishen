import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * The app's link. Same as `next/link`, with background prefetch turned off.
 *
 * Why: every page here is rendered per request (it shows the signed-in
 * user's data), so a prefetch can never carry the page itself — only its
 * loading skeleton. That cost one request per visible link, each running the
 * middleware's login check: a list of 40 plants meant 40 extra requests.
 * Tapping a link loads the page exactly as before, and pages visited in the
 * last 30 seconds come back instantly from the router's kept copy (see
 * next.config.ts).
 *
 * The few links that are always on screen and tapped all the time (the tab
 * bars) pass `prefetch={null}` to get the default back: their skeleton is
 * then ready before the tap.
 *
 * Use this instead of importing `next/link` directly.
 */
export function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
