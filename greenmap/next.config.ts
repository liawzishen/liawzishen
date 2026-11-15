import type { NextConfig } from "next";

/**
 * Security headers sent with every response. (The Content-Security-Policy is
 * not here: it needs a new nonce per page, so the middleware sets it.)
 * - nosniff: browsers must not guess content types.
 * - frame options: other sites cannot embed GreenMap in a frame (clickjacking).
 * - opener policy: a page opened from GreenMap, or one that opened it, gets
 *   no handle on our window.
 * - referrer policy: other sites only see our origin, never the full URL
 *   (a passport link contains its secret token).
 * - permissions policy: the app uses geolocation (farm GPS pin) and nothing
 *   else from this list.
 * - HSTS: browsers keep using HTTPS (ignored on plain-HTTP localhost).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(self), microphone=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Keep Next's build tracing inside this project folder. Without this, Next
  // can pick up a lockfile in a parent folder and trace from there instead.
  outputFileTracingRoot: process.cwd(),
  // Do not advertise the framework in an "X-Powered-By" header.
  poweredByHeader: false,
  experimental: {
    // Keep a visited page in the browser for 30 seconds, so going back to a
    // tab is instant (no server trip, no skeleton). Every action that changes
    // data must call `refreshData()` (lib/router/refresh.tsx), which drops
    // the kept pages — otherwise they could show old data for up to 30 s.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API answers are personal (and some carry a signed scan receipt):
      // no browser or proxy may keep a copy.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  webpack: (config) => {
    // Konva's Node build references the optional native "canvas" package,
    // which we never use (our map runs only in the browser). Mark it
    // external so webpack never tries to bundle the missing module.
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
