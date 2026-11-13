import type { NextConfig } from "next";

/**
 * Security headers sent with every response.
 * - nosniff: browsers must not guess content types.
 * - frame options: other sites cannot embed GreenMap in a frame (clickjacking).
 * - referrer policy: other sites only see our origin, never the full URL
 *   (a passport link contains its secret token).
 * - permissions policy: the app uses geolocation (farm GPS pin) and nothing
 *   else from this list.
 * - HSTS: browsers keep using HTTPS (ignored on plain-HTTP localhost).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
