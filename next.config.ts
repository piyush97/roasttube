import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack's root: a stray package-lock.json above the repo made Next
// infer the home directory as root, which broke PostCSS plugin resolution.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  // Baseline security headers on every response.
  //
  // The source must be `/(.*)`, not `/:path*`. vinext compiles a `:param`
  // segment to `[^/]+`, so `/:path*` becomes `^/[^/]+.*$`, which requires at
  // least one path segment and therefore never matches the root path. That
  // silently stripped these headers from `/` alone while every other route
  // kept them (verified against vinext's own matcher). Next.js itself does
  // match `/` with `/:path*`, so this is a vinext divergence worth remembering.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
