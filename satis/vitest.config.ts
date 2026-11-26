import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    env: {
      CORE_API_URL: "http://core.test",
      SALES_API_SECRET: "test-secret-test-secret-test-secret-0123",
      SITE_URL: "http://localhost:3370",
      NODE_ENV: "test",
    },
  },
});
