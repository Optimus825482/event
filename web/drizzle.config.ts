import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Şerit worktree'lerinde `npm run db:migrate` şeridin DATABASE_URL'sini kullansın (süreç ortamı önceliklidir).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres@localhost:54329/eventflow_dev",
  },
});
