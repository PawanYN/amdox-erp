import type { NextConfig } from "next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";

const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Traces the minimal set of files/node_modules the server actually needs
  // into .next/standalone, so the distroless production image doesn't have
  // to carry the full workspace node_modules tree.
  output: "standalone",
};

export default withBundleAnalyzer(nextConfig);
