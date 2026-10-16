import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev server reached over Tailscale (tailnet only); Next blocks other hosts in dev otherwise.
  allowedDevOrigins: ["arm-lab-thinkstation-p5.tailcb64b8.ts.net", "arm-lab-thinkstation-p5", "100.72.152.8"],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
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
