import path from "node:path";
import { defineConfig } from "vitest/config";
import { resolveTestDbName, testDatabaseUrl } from "./tests/helpers/db-name";

// Geçersiz TEST_DB_NAME burada, hiçbir bağlantı kurulmadan önce hata verir.
const testDbName = resolveTestDbName(process.env.TEST_DB_NAME);

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    // Test dosyaları tek bir test veritabanını paylaşır (ajan başına ayrı veritabanı için TEST_DB_NAME); paralel çalışırlarsa birbirlerinin satırlarını siler.
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    env: {
      DATABASE_URL: testDatabaseUrl(testDbName),
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
      BETTER_AUTH_URL: "http://localhost:3000",
      UPLOAD_DIR: "./uploads-test",
      NODE_ENV: "test",
    },
  },
});
