import pg from "pg";
import { migrateAssignments } from "./assignments";
import { migrateCatalogs } from "./catalogs";
import { migrateContent } from "./content";
import { Ctx } from "./context";
import { CustomerDirectory, migrateGuestNotes } from "./customers";
import { migrateEvents } from "./events";
import { addSchemaGaps } from "./gaps";
import { type LegacyData, type LegacySource, loadLegacy, openLegacy, sourceCounts } from "./legacy";
import { migratePeople } from "./people";
import { finalizeTables, type MigrationReport, ReportBuilder } from "./report";
import { migrateReservations } from "./reservations";
import { assertLatestMigration, countRows, MIGRATIONS_DIR, nonEmptyDomainTables, openTarget, Writer } from "./target";
import { migrateTeams } from "./teams";
import { verifyTarget } from "./verify";

export type RunOptions = {
  legacyUrl: string;
  targetUrl: string;
  dryRun: boolean;
  legacyTz: string;
  /** false: hedefte veri olsa da çalışır (`--force-empty-check=off`). */
  emptyCheck: boolean;
  defaultOrganizerId?: string;
  makeQrToken?: (reservationId: string) => string;
  migrationsDir?: string;
};

/** Hata metnini rapora/konsola yazılabilir hale getirir: veritabanı hatalarında değerler ayıklanır. */
export function describeError(error: unknown): string {
  if (error instanceof pg.DatabaseError) {
    const where = [error.table, error.constraint].filter(Boolean).join(" / ");
    return `PostgreSQL ${error.code ?? "?"}${where ? ` [${where}]` : ""}: ${error.message.replace(/"[^"]*"/g, (m) => (m === `"${error.constraint}"` ? m : '"…"'))}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function reconcile(data: LegacyData, ctx: Ctx): Record<string, number> {
  const c = ctx.report.report.categories;
  const merged = c.customerMerges.reduce((n, f) => n + (Array.isArray(f.mergedIds) ? f.mergedIds.length : 0), 0);
  const created = new Set([
    ...c.customersFromGuest.filter((f) => f.action === "created").map((f) => String(f.customerId)),
    ...c.placeholderCustomers.map((f) => String(f.customerId)),
  ]).size;
  return {
    users: data.users.length,
    accounts: data.users.length,
    events: data.events.length,
    reservations: data.reservations.length,
    staff: data.staff.length + c.unmatchedStaff.length,
    customers: data.customers.length - merged + created,
    event_tables: c.tableIdMap.length + c.placeholderTables.length,
    teams: data.teams.length + data.service_teams.length,
    work_shifts: data.work_shifts.length,
    service_points: data.service_points.length,
    notifications: data.notifications.length,
    invitation_templates: data.invitation_templates.length,
    venue_templates: data.venue_templates.length,
    staff_performance_reviews:
      data.staff_performance_reviews.length -
      c.reviewConflicts.length -
      [...c.unresolvedStaffReferences, ...c.skippedRows].filter((f) => f.table === "staff_performance_reviews").length,
    guest_notes:
      data.guest_notes.length + c.conflictingReservations.reduce((n, f) => n + (Array.isArray(f.cancelledReservationIds) ? f.cancelledReservationIds.length : 0), 0) -
      c.skippedRows.filter((f) => f.table === "guest_notes").length,
  };
}

async function load(ctx: Ctx): Promise<void> {
  const catalogs = await migrateCatalogs(ctx);
  await migratePeople(ctx, catalogs);
  await migrateEvents(ctx);
  const customers = new CustomerDirectory(ctx);
  customers.load();
  const notes = await migrateReservations(ctx, customers);
  await migrateGuestNotes(ctx, notes);
  const teamIdMap = await migrateTeams(ctx);
  await migrateAssignments(ctx, teamIdMap);
  await migrateContent(ctx);
  addSchemaGaps(ctx);
}

/**
 * Tüm taşıma: eski veriyi salt-okunur anlık görüntüden okur, hedefe TEK işlemde yazar, doğrular;
 * `dryRun` ya da herhangi bir hata/doğrulama başarısızlığında işlemi geri alır. Rapor her durumda döner.
 */
export async function runMigration(options: RunOptions): Promise<MigrationReport> {
  const builder = new ReportBuilder(options.dryRun ? "dry-run" : "commit", options.legacyTz);
  const report = builder.report;
  let legacy: LegacySource | null = null;
  let target: Awaited<ReturnType<typeof openTarget>> | null = null;
  let inTransaction = false;
  try {
    legacy = await openLegacy(options.legacyUrl);
    const data = await loadLegacy(legacy.client, options.legacyTz);
    report.sourceCounts = sourceCounts(data);

    target = await openTarget(options.targetUrl);
    await assertLatestMigration(target.client, options.migrationsDir ?? MIGRATIONS_DIR);
    if (options.emptyCheck) {
      const nonEmpty = await nonEmptyDomainTables(target.client);
      if (nonEmpty.length > 0) throw new Error(`Hedef boş değil (${nonEmpty.join(", ")}); --force-empty-check=off olmadan çalışmaz`);
    }

    await target.client.query("BEGIN");
    inTransaction = true;
    // Uygulama ortamını (env.ts) yalnızca gerektiğinde yükle: anahtar BETTER_AUTH_SECRET/QR_SIGNING_KEY'den gelir.
    const makeQrToken = options.makeQrToken ?? (await import("./qr")).qrTokenFactory();
    const writer = new Writer(target.db);
    const ctx = new Ctx(data, writer, builder, { defaultOrganizerId: options.defaultOrganizerId, makeQrToken });
    await load(ctx);

    report.verification = await verifyTarget(target.client, {
      written: writer.written,
      reconcile: reconcile(data, ctx),
      legacyQrHashes: data.reservations.filter((r) => r.str("qrCodeHash") !== null).length,
      makeQrToken,
    });
    report.targetCounts = await countRows(target.client);
    const failed = report.verification.filter((v) => !v.ok);
    if (failed.length > 0) throw new Error(`Doğrulama başarısız: ${failed.map((f) => f.name).join("; ")}`);

    await target.client.query(options.dryRun ? "ROLLBACK" : "COMMIT");
    inTransaction = false;
    report.outcome = options.dryRun ? "rolled-back" : "committed";
  } catch (error) {
    report.outcome = "failed";
    report.error = describeError(error);
    if (target && inTransaction) await target.client.query("ROLLBACK").catch(() => undefined);
  } finally {
    report.finishedAt = new Date().toISOString();
    finalizeTables(report);
    if (legacy) await legacy.close().catch(() => undefined);
    if (target) await target.client.end().catch(() => undefined);
  }
  return report;
}
