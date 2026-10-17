import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack's root: a stray package-lock.json above the repo made Next
// infer the home directory as root, which broke PostCSS plugin resolution.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: { root: projectRoot },
};

export default nextConfig;
