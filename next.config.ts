import type { NextConfig } from "next";
import { assertNoDevAuthBypassInProduction } from "./src/lib/auth/dev-bypass";

// `next build` / `next start` refuse to run with the dev-only login bypass configured.
assertNoDevAuthBypassInProduction();

// Extra hostnames allowed to reach the dev server (e.g. a Tailscale name or LAN IP).
// Comma-separated; empty by default.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async redirects() {
    // The Stories tab was merged into Epics.
    return [
      {
        source: "/repo/:owner/:repo/stories",
        destination: "/repo/:owner/:repo/epics",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
