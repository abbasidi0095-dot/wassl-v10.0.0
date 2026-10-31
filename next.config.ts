import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker builds set BUILD_STANDALONE=1 to emit .next/standalone. Regular
  // builds stay compatible with `next start` and the Playwright webServer.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  async rewrites() {
    return [
      // Mobile deep-link verification files must be extension-less/canonical.
      { source: "/.well-known/assetlinks.json", destination: "/api/well-known/assetlinks" },
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/api/well-known/aasa",
      },
    ];
  },
};

export default nextConfig;
