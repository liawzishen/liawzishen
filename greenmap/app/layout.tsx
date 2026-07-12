import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

/*
 * Fredoka — the rustic display face — now loads at the root (design decision
 * 2026-07-05: the whole app converges on the login page's rustic farm theme).
 * Exposed as --font-fredoka, consumed via the `font-rustic` utility.
 */
const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GreenMap", template: "%s · GreenMap" },
  description:
    "AI-powered farm management and harvest transparency for Malaysian smallholder farmers.",
};

export const viewport: Viewport = {
  themeColor: "#faf3e3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cookie-based locale (no /[locale] routing — the app is auth-gated, so
  // URL locales would add churn without SEO benefit). Reading it here means
  // the first paint is already in the user's language.
  const lang = await getLang();

  return (
    // The font variable must live on <html> (:root): --font-rustic is defined
    // at :root and resolves var(--font-fredoka) THERE — on a descendant it
    // would be invisible to it and Fredoka would silently never apply.
    <html lang={lang} className={fredoka.variable}>
      <body>
        {/*
          Mobile-first app frame (06 §7): target 393–430px wide.
          Desktop simply centres the frame — full desktop layouts are Phase 2.
          Pages carrying the `auth-breakout` marker (the split login) escape
          the frame via the .app-frame:has() rule in globals.css.
        */}
        <LanguageProvider initialLang={lang}>
          <div className="app-frame relative mx-auto min-h-dvh w-full max-w-[430px] bg-bg sm:border-x sm:border-black/5">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
