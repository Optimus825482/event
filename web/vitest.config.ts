import path from "node:path";
import { defineConfig } from "vitest/config";
import { resolveTestDbName, testDatabaseUrl } from "./tests/helpers/db-name";
import { localTestDbName } from "./tests/helpers/local-env";

// Süreç ortamı, yoksa web/.env.local (yalnızca TEST_DB_NAME). Geçersiz ad burada, hiçbir bağlantı kurulmadan önce hata verir.
const testDbName = resolveTestDbName(localTestDbName(process.env, import.meta.dirname));
// globalSetup ana süreçte çalışır; test.env yalnızca çalışanlara geçer.
process.env.TEST_DB_NAME = testDbName;

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
      TEST_DB_NAME: testDbName,
      DATABASE_URL: testDatabaseUrl(testDbName),
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
      BETTER_AUTH_URL: "http://localhost:3000",
      UPLOAD_DIR: "./uploads-test",
      NODE_ENV: "test",
    },
  },
});
