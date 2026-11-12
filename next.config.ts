import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server in .next/standalone for the Docker image.
  output: "standalone",
  // Native modules must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@node-rs/argon2"],
  headers() {
    return [
      {
        // The OAuth consent screen must never load inside another site's frame (clickjacking).
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;

