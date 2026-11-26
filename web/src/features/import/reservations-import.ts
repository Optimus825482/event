import { and, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, reservations } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow } from "@/features/events/service";
import { ACTIVE_STATUSES, assertBookable, MSG } from "@/features/reservations/internal";
import { createReservation } from "@/features/reservations/service";
import { DomainError } from "@/lib/action";
import { logError } from "@/lib/log";
import { checkReservationRow, parseReservationRows, TableIndex } from "./reservation-rows";
import type { ImportRowResult, PreviewResult } from "./types";
import { readFirstSheet } from "./xlsx-reader";

type Executor = Db | Tx;
export type ReservationImportInput = { eventId: string; bytes: Uint8Array };

export type ReservationImportResult = {
  rows: ImportRowResult[];
  createdCount: number;
  skippedCount: number;
};

async function loadContext(db: Executor, actor: Actor, eventId: string) {
  authorize(actor, "reservations", "create");
  const event = await getEventOrThrow(db, eventId);
  assertBookable(event);
  const tables = await db
    .select({ id: eventTables.id, label: eventTables.label, capacity: eventTables.capacity, allocation: eventTables.allocation })
    .from(eventTables)
    .where(eq(eventTables.eventId, event.id));
  return { event, tables, index: new TableIndex(tables) };
}

/**
 * Önizleme: dosyayı ayrıştırır ve her satırı doğrular; HİÇBİR ŞEY YAZMAZ. Dolu masa ve kapasite
 * gibi veritabanı durumuna bağlı kurallar okunarak önceden gösterilir; kesin karar yine
 * `createReservation`dadır (onayda dosya yeniden ayrıştırılır, önizleme sonucuna güvenilmez).
 */
export async function previewReservationImport(
  db: Executor,
  actor: Actor,
  input: ReservationImportInput,
): Promise<PreviewResult> {
  const { event, tables, index } = await loadContext(db, actor, input.eventId);
  const parsed = parseReservationRows(await readFirstSheet(input.bytes));

  const active = await db
    .select({ tableId: reservations.tableId })
    .from(reservations)
    .where(and(eq(reservations.eventId, event.id), inArray(reservations.status, [...ACTIVE_STATUSES])));
  const taken = new Set(active.map((r) => r.tableId));
  const capacity = new Map(tables.map((t) => [t.id, t.capacity]));
  const allocation = new Map(tables.map((t) => [t.id, t.allocation]));

  const rows = parsed.map((row): PreviewResult["rows"][number] => {
    const check = checkReservationRow(event.id, index, row);
    const summary = [row.tableLabel, row.guestName, row.guestCount && `${row.guestCount} kişi`].filter(Boolean).join(" · ");
    if (!check.ok) return { row: row.row, status: "error", message: check.message, summary };
    if (allocation.get(check.table.id) !== "casino") {
      return { row: row.row, status: "error", message: MSG.notCasinoTable, summary };
    }
    const limit = capacity.get(check.table.id) ?? 0;
    if (check.input.guestCount > limit) {
      return {
        row: row.row,
        status: "error",
        message: `Kişi sayısı (${check.input.guestCount}) masa kapasitesini (${limit}) aşıyor`,
        summary,
      };
    }
    if (taken.has(check.table.id)) return { row: row.row, status: "error", message: MSG.tableTaken, summary };
    taken.add(check.table.id);
    return { row: row.row, status: "ok", message: "Oluşturulabilir", summary };
  });
  const errorCount = rows.filter((r) => r.status === "error").length;
  return { rows, okCount: rows.length - errorCount, errorCount };
}

/**
 * Onay: dosya yeniden ayrıştırılır; her satır dosya sırasıyla, KENDİ TRANSACTION'ında
 * `createReservation`dan geçer (manuel girişle aynı müsaitlik, kapasite, kara liste ve QR kuralları).
 * Hatalı satır yalnızca kendini geri alır; sonuç satır başına `created | skipped`.
 */
export async function importReservations(
  db: Executor,
  actor: Actor,
  input: ReservationImportInput,
): Promise<ReservationImportResult> {
  const { event, index } = await loadContext(db, actor, input.eventId);
  const parsed = parseReservationRows(await readFirstSheet(input.bytes));

  const rows: ImportRowResult[] = [];
  for (const row of parsed) {
    const check = checkReservationRow(event.id, index, row);
    if (!check.ok) {
      rows.push({ row: row.row, status: "skipped", message: check.message });
      continue;
    }
    try {
      await createReservation(db, actor, check.input);
      rows.push({ row: row.row, status: "created", message: "Rezervasyon oluşturuldu" });
    } catch (error) {
      if (error instanceof DomainError) {
        rows.push({ row: row.row, status: "skipped", message: error.message });
      } else {
        logError("import:reservations", error);
        rows.push({ row: row.row, status: "skipped", message: "Beklenmeyen bir hata oluştu" });
      }
    }
  }
  const createdCount = rows.filter((r) => r.status === "created").length;
  return { rows, createdCount, skippedCount: rows.length - createdCount };
}
