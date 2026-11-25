/**
 * Eski EventFlow (NestJS/TypeORM) veritabanından yeni şemaya tek seferlik veri taşıma.
 *
 * Kullanım (web/ dizininden):
 *   LEGACY_DATABASE_URL=... DATABASE_URL=... BETTER_AUTH_SECRET=... \
 *     npx tsx scripts/migrate-legacy/index.ts [--dry-run] [--report <yol>] \
 *       [--force-empty-check=off] [--default-organizer <kullanıcı-uuid>]
 *
 * Ortam: LEGACY_DATABASE_URL (salt-okunur açılır), DATABASE_URL (hedef), LEGACY_TZ (zorunlu, varsayılanı yok:
 * Asia/Famagusta ya da Europe/Istanbul), BETTER_AUTH_SECRET / QR_SIGNING_KEY (uygulamayla aynı; QR belirteçleri için).
 * Çıkış kodu: 0 başarılı (dry-run dahil), 1 hata ya da doğrulama başarısızlığı, 2 kullanım hatası.
 * Konsola yalnızca sayılar yazılır; ayrıntı `--report` dosyalarındadır (.json ve .txt).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderSummary, renderText } from "./report";
import { runMigration } from "./run";
import { isUuid } from "./values";

export type CliArgs = {
  dryRun: boolean;
  reportPath: string | null;
  emptyCheck: boolean;
  defaultOrganizerId?: string;
};

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { dryRun: false, reportPath: null, emptyCheck: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    const [flag, inline] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || v === "") throw new Error(`${flag} bir değer bekliyor`);
      return v;
    };
    if (flag === "--dry-run") out.dryRun = true;
    else if (flag === "--report") out.reportPath = value();
    else if (flag === "--force-empty-check") {
      const v = value();
      if (v !== "off" && v !== "on") throw new Error("--force-empty-check yalnızca on|off alır");
      out.emptyCheck = v === "on";
    } else if (flag === "--default-organizer") {
      const v = value();
      if (!isUuid(v)) throw new Error("--default-organizer bir kullanıcı uuid'i olmalı");
      out.defaultOrganizerId = v.toLowerCase();
    } else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  return out;
}

async function writeReport(reportPath: string, json: string, text: string): Promise<{ json: string; text: string }> {
  const base = reportPath.replace(/\.(json|txt)$/i, "");
  await mkdir(path.dirname(path.resolve(base)), { recursive: true });
  const files = { json: `${base}.json`, text: `${base}.txt` };
  await writeFile(files.json, json, "utf8");
  await writeFile(files.text, text, "utf8");
  return files;
}

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Kullanım: tsx scripts/migrate-legacy/index.ts [--dry-run] [--report <yol>] [--force-empty-check=off] [--default-organizer <uuid>]");
    return 2;
  }
  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!legacyUrl || !targetUrl) {
    console.error("LEGACY_DATABASE_URL ve DATABASE_URL ortam değişkenleri gerekli");
    return 2;
  }
  if (legacyUrl === targetUrl) {
    console.error("LEGACY_DATABASE_URL ile DATABASE_URL aynı olamaz");
    return 2;
  }
  const legacyTz = process.env.LEGACY_TZ?.trim();
  if (!legacyTz) {
    console.error(
      "LEGACY_TZ ortam değişkeni gerekli: eski veritabanındaki `timestamp without time zone` değerlerinin yazıldığı saat dilimi. " +
        "Olası değerler: Asia/Famagusta (Kıbrıs saati) ya da Europe/Istanbul (sabit UTC+3). Hiçbir şey değiştirilmedi.",
    );
    return 2;
  }
  const report = await runMigration({
    legacyUrl,
    targetUrl,
    dryRun: args.dryRun,
    legacyTz,
    emptyCheck: args.emptyCheck,
    defaultOrganizerId: args.defaultOrganizerId,
  });
  console.log(renderSummary(report));
  if (args.reportPath) {
    const files = await writeReport(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, renderText(report));
    console.log(`Rapor: ${files.json} , ${files.text}`);
  }
  return report.outcome === "failed" ? 1 : 0;
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
