import type { ReactNode } from "react";
import { Fredoka } from "next/font/google";

/*
 * Auth-only theme wrapper.
 *
 * Loads Fredoka (the rustic display face) as a CSS variable and marks the
 * subtree with `.auth-rustic`. The rustic colour tokens + utilities live in
 * globals.css but are only *used* here, so the rest of the app (all glass) is
 * untouched. `.auth-breakout` on the page's <main> still escapes the 430px
 * phone frame — `.app-frame:has(.auth-breakout)` matches straight through this
 * wrapper div.
 */
const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  display: "swap",
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={`${fredoka.variable} auth-rustic`}>{children}</div>;
}
