import path from "node:path";
import type { NextConfig } from "next";

// Placeholder for Phase 4: when API_URL is set, /api/* is proxied to the API (same-origin cookies).
const apiUrl = process.env.API_URL;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  // Workspace packages export TypeScript source.
  transpilePackages: ["@algoforge/analysis", "@algoforge/contracts", "@algoforge/forge"],
  async rewrites() {
    return apiUrl ? [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }] : [];
  },
};

export default nextConfig;
