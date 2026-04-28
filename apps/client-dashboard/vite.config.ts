import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, type PluginOption } from "vite";

const sentryPlugin =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_DSN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG ?? "nomly",
        project: process.env.SENTRY_PROJECT ?? "lattelink-operator-web",
        authToken: process.env.SENTRY_AUTH_TOKEN
      })
    : undefined;

export default defineConfig({
  build: {
    sourcemap: true
  },
  plugins: [sentryPlugin].filter(Boolean) as PluginOption[]
});
