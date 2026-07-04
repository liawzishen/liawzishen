import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GreenMap", template: "%s · GreenMap" },
  description:
    "AI-powered farm management and harvest transparency for Malaysian smallholder farmers.",
};

export const viewport: Viewport = {
  themeColor: "#F2F2F7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/*
          Mobile-first app frame (06 §7): target 393–430px wide.
          Desktop simply centres the frame — full desktop layouts are Phase 2.
          Pages carrying the `auth-breakout` marker (the split login) escape
          the frame via the .app-frame:has() rule in globals.css.
        */}
        <div className="app-frame relative mx-auto min-h-dvh w-full max-w-[430px] bg-bg sm:border-x sm:border-black/5">
          {children}
        </div>
      </body>
    </html>
  );
}
