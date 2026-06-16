import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next's build tracing inside this project folder. Without this, Next
  // detects the parent C:\Users\Dell lockfile and may try to trace there.
  outputFileTracingRoot: process.cwd(),
  webpack: (config) => {
    // Konva's Node build references the optional native "canvas" package,
    // which we never use (our map runs only in the browser). Mark it
    // external so webpack never tries to bundle the missing module.
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
