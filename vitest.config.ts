import { defineConfig } from "vitest/config";

// Tests cover pure modules; they don't need the Cloudflare or React plugins.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
