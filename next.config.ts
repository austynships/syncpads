import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server in .next/standalone for the Docker image.
  output: "standalone",
  // Native modules must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;

