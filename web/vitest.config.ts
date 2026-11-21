import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    // Test dosyaları tek bir test veritabanını paylaşır; paralel çalışırlarsa birbirlerinin satırlarını siler.
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    env: {
      DATABASE_URL: "postgres://postgres@localhost:54329/eventflow_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
      BETTER_AUTH_URL: "http://localhost:3000",
      UPLOAD_DIR: "./uploads-test",
      NODE_ENV: "test",
    },
  },
});
