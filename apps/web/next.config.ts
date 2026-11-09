import path from "node:path";
import type { NextConfig } from "next";

/**
 * Same-origin deployment (decision D4): the browser only ever talks to the web origin, and Next forwards /api/* to the API.
 * Cookies are then first-party (host-only, SameSite=Lax) and CORS is not involved.
 *  - API_URL unset in development  -> http://localhost:4000
 *  - API_URL unset in production   -> no proxy (a warning is printed): set it where `next build` runs.
 * See docs/phase4-auth-and-deployment.md.
 */
const DEV_API_URL = "http://localhost:4000";
const isProduction = process.env.NODE_ENV === "production";
const apiUrl = (process.env.API_URL ?? (isProduction ? "" : DEV_API_URL)).trim().replace(/\/+$/, "");

if (isProduction && !apiUrl) {
  console.warn("[next.config] API_URL is not set: /api/* will NOT be proxied to the API. Set API_URL at build time.");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  // Workspace packages export TypeScript source.
  transpilePackages: ["@algoforge/analysis", "@algoforge/contracts", "@algoforge/visualizer-core"],
  async rewrites() {
    return apiUrl ? [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }] : [];
  },
  async redirects() {
    return [
      { source: "/share/analysis/:id", destination: "/s/:id", permanent: false },
      { source: "/share/explain/:id", destination: "/s/:id", permanent: false },
    ];
  },
};

export default nextConfig;
