import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrationReport } from "../../../scripts/migrate-legacy/report";
import { createLegacyDb, createTargetDb, dbUrl, dropDb, totalRows, uniqueDbName, withClient } from "./harness";
import { seedLegacy } from "./seed";

const WEB = path.resolve(import.meta.dirname, "../../..");
const TSX = path.join(WEB, "node_modules", "tsx", "dist", "cli.mjs");
const LEGACY = uniqueDbName("eventflow_legacy_test", "cli");
const TARGET = uniqueDbName("eventflow_etl_test", "cli");
const OUT = mkdtempSync(path.join(tmpdir(), "migrate-legacy-"));

function cli(args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [TSX, "scripts/migrate-legacy/index.ts", ...args], {
    cwd: WEB,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      SYSTEMROOT: process.env.SYSTEMROOT ?? "",
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
      ...env,
    },
    timeout: 120_000,
  });
}

beforeAll(async () => {
  await createLegacyDb(LEGACY);
  await withClient(LEGACY, seedLegacy);
  await createTargetDb(TARGET);
}, 120_000);

afterAll(async () => {
  await dropDb(LEGACY);
  await dropDb(TARGET);
  rmSync(OUT, { recursive: true, force: true });
}, 180_000);

describe("CLI", () => {
  it("--dry-run raporu yazar, hedefi boş bırakır, konsola kişisel veri yazmaz", async () => {
    const reportBase = path.join(OUT, "rapor");
    const run = cli(["--dry-run", "--report", reportBase], { LEGACY_DATABASE_URL: dbUrl(LEGACY), DATABASE_URL: dbUrl(TARGET) });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/Taşıma \(dry-run\) sonucu: rolled-back/);
    expect(run.stdout).not.toMatch(/example\.test|0532|\+90/);
    expect(existsSync(`${reportBase}.json`)).toBe(true);
    expect(readFileSync(`${reportBase}.txt`, "utf8")).toMatch(/Çakışan rezervasyonlar/);
    const report = JSON.parse(readFileSync(`${reportBase}.json`, "utf8")) as MigrationReport;
    expect(report.outcome).toBe("rolled-back");
    expect(report.categories.conflictingReservations).toHaveLength(2);
    expect(await totalRows(TARGET)).toBe(0);
  }, 120_000);

  it("eksik ortam değişkeni ve aynı kaynak/hedef kullanım hatasıdır", () => {
    expect(cli([], { DATABASE_URL: dbUrl(TARGET) }).status).toBe(2);
    expect(cli([], { LEGACY_DATABASE_URL: dbUrl(TARGET), DATABASE_URL: dbUrl(TARGET) }).status).toBe(2);
    expect(cli(["--bogus"], {}).status).toBe(2);
  }, 60_000);
});
