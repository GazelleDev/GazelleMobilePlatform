import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "nomly",
  project: process.env.SENTRY_PROJECT ?? "lattelink-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true
  }
});
