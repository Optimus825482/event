import type { Db, Tx } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { ensureStaffingAccess, getReadableEvent, lockEditableEvent } from "@/features/staffing/access";
import { saveAssignments } from "@/features/staffing/assignments-service";
import { DomainError } from "@/lib/action";
import { buildAssignmentPlan } from "./assignment-plan";
import { parseAssignmentRows } from "./assignment-rows";
import type { ImportRowResult, PreviewResult } from "./types";
import { readFirstSheet } from "./xlsx-reader";

export type AssignmentImportInput = { eventId: string; bytes: Uint8Array };

export type AssignmentImportResult = {
  /** `true`: dosyadaki tüm satırlar tek transaction'da yazıldı; `false`: hata olduğundan hiçbir şey yazılmadı. */
  written: boolean;
  rows: ImportRowResult[];
  /** Yazılan (ya da yazılacak) benzersiz personel + vardiya atamaları. */
  appliedCount: number;
};

const LOCKED = "Tamamlanmış veya iptal edilmiş etkinlikte ekip organizasyonu değiştirilemez";

/** Önizleme: çözümleme okunarak yapılır; hiçbir şey yazılmaz. İzin: ekip organizasyonu kaydıyla aynı (`staff.edit`). */
export async function previewAssignmentImport(
  db: Db | Tx,
  actor: Actor,
  input: AssignmentImportInput,
): Promise<PreviewResult> {
  ensureStaffingAccess(actor, "edit");
  const event = await getReadableEvent(db, actor, input.eventId);
  if (event.status === "completed" || event.status === "cancelled") throw new DomainError("conflict", LOCKED);
  const parsed = parseAssignmentRows(await readFirstSheet(input.bytes));
  const plan = await buildAssignmentPlan(db, event.id, parsed);
  const rows = plan.rows.map(({ row, status, message, summary }) => ({ row, status, message, summary }));
  const errorCount = rows.filter((r) => r.status === "error").length;
  return { rows, okCount: rows.length - errorCount, errorCount };
}

/**
 * Onay: dosya yeniden ayrıştırılır ve çözümlenir; tek transaction'da etkinlik kilitlenir, satır
 * hataları denetlenir ve hata yoksa `saveAssignments` (yalnızca `table` türü) ile hepsi birlikte
 * yazılır. Tek hatalı satır varsa hiçbir şey yazılmaz.
 */
export async function importAssignments(
  db: Db | Tx,
  actor: Actor,
  input: AssignmentImportInput,
): Promise<AssignmentImportResult> {
  ensureStaffingAccess(actor, "edit");
  const parsed = parseAssignmentRows(await readFirstSheet(input.bytes));

  return db.transaction(async (tx) => {
    await lockEditableEvent(tx, actor, input.eventId);
    const plan = await buildAssignmentPlan(tx, input.eventId, parsed);
    if (plan.hasErrors) {
      const rows = plan.rows.map((r): ImportRowResult => ({
        row: r.row,
        status: "skipped",
        message: r.error ? r.message : "Dosyadaki başka satırlarda hata olduğu için yazılmadı",
      }));
      return { written: false, rows, appliedCount: 0 };
    }
    await saveAssignments(tx, actor, { eventId: input.eventId, types: ["table"], assignments: plan.items });
    const rows = plan.rows.map((r): ImportRowResult => ({ row: r.row, status: "created", message: r.message }));
    return { written: true, rows, appliedCount: plan.importedCount };
  });
}
