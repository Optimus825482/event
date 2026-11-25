/**
 * Yerleşim kilidi: satış başladıktan sonra (`on_sale`, `sales_closed`) taahhütlü masalar
 * (rezervasyon; ileride Casino tahsisi ve bilet) silinemez, taşınamaz, etiketi/kat/tipi
 * değiştirilemez, kapasitesi taahhüdün altına indirilemez. Taahhütsüz masalar serbesttir.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, reservations } from "@/db/schema";
import { isLayoutLockedStage, type PlanningStage } from "@/domain/planning-stage";
import { ACTIVE_RESERVATION_STATUSES } from "@/domain/reservation-status";
import { DomainError } from "@/lib/action";

export type CommitmentReason = "reservation" | "casino_allocation" | "ticket";

export type CommitmentRow = { tableId: string; reason: CommitmentReason; seats: number };

export type CommitmentSource = (ex: Db | Tx, eventId: string) => Promise<CommitmentRow[]>;

/** Etkin (`pending|confirmed|checked_in`) rezervasyonlar; koltuk sayısı misafir sayısıdır. */
export const reservationCommitments: CommitmentSource = async (ex, eventId) => {
  const rows = await ex
    .select({ tableId: reservations.tableId, seats: reservations.guestCount })
    .from(reservations)
    .where(and(eq(reservations.eventId, eventId), inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES])));
  return rows.map((r) => ({ tableId: r.tableId, reason: "reservation" as const, seats: r.seats }));
};

/** Faz 4 `casino_allocation`, Faz 6 `ticket` kaynağını bu diziye ekler; başka değişiklik gerekmez. */
export const COMMITMENT_SOURCES: readonly CommitmentSource[] = [reservationCommitments];

export type TableCommitment = { tableId: string; reasons: CommitmentReason[]; minCapacity: number };

export type LockTableSnapshot = {
  id: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  rotation: number;
  floor: number;
  tableTypeId: string | null;
};

/** `TableInput`'un alt kümesi; kimliksiz girdi yeni masadır. */
export type LockTableInput = Partial<LockTableSnapshot> & { id?: string };

export type LockedChangeKind =
  | "deleted"
  | "moved"
  | "relabeled"
  | "capacity_below_committed"
  | "floor_changed"
  | "type_changed";

export type LockedChange = { tableId: string; label: string; change: LockedChangeKind };

/** Konum ve dönüş için tolerans (çizim yuvarlamaları taşıma sayılmaz). */
const POSITION_EPSILON = 0.5;

/** `writeLayout` ile aynı varsayılanlar: eksik dönüş 0, eksik kat 1, eksik tip null. */
const DEFAULT_ROTATION = 0;
const DEFAULT_FLOOR = 1;

function rotationDistance(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
}

function differs(a: number, b: number | undefined): boolean {
  return b === undefined || !Number.isFinite(b) || Math.abs(a - b) > POSITION_EPSILON;
}

function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, "tr", { numeric: true });
}

/** Saf: kilitli (taahhütlü) masalarda yasak değişiklikleri bulur; sonuç etikete göre sıralıdır. */
export function findLockedChanges(
  current: readonly LockTableSnapshot[],
  next: readonly LockTableInput[],
  commitments: ReadonlyMap<string, TableCommitment>,
): LockedChange[] {
  const nextById = new Map<string, LockTableInput>();
  for (const t of next) if (t.id) nextById.set(t.id, t);

  const changes: LockedChange[] = [];
  for (const table of current) {
    const commitment = commitments.get(table.id);
    if (!commitment) continue;
    const push = (change: LockedChangeKind) => changes.push({ tableId: table.id, label: table.label, change });
    const n = nextById.get(table.id);
    if (!n) {
      push("deleted");
      continue;
    }
    const rotation = n.rotation ?? DEFAULT_ROTATION;
    if (
      differs(table.x, n.x) ||
      differs(table.y, n.y) ||
      !Number.isFinite(rotation) ||
      rotationDistance(table.rotation, rotation) > POSITION_EPSILON
    ) {
      push("moved");
    }
    if (n.label === undefined || n.label.trim() !== table.label) push("relabeled");
    if (n.capacity === undefined || n.capacity < commitment.minCapacity) push("capacity_below_committed");
    if ((n.floor ?? DEFAULT_FLOOR) !== table.floor) push("floor_changed");
    if ((n.tableTypeId ?? null) !== table.tableTypeId) push("type_changed");
  }
  // Array.prototype.sort kararlıdır: aynı masanın değişiklikleri bulunma sırasını korur.
  return changes.sort((a, b) => compareLabels(a.label, b.label));
}

const REASON_ORDER: readonly CommitmentReason[] = ["reservation", "casino_allocation", "ticket"];

/** Tüm kaynaklardaki taahhütleri masa başına toplar (`minCapacity` = koltuk toplamı). */
export async function loadCommitments(ex: Db | Tx, eventId: string): Promise<Map<string, TableCommitment>> {
  const result = new Map<string, TableCommitment>();
  for (const source of COMMITMENT_SOURCES) {
    for (const row of await source(ex, eventId)) {
      const entry = result.get(row.tableId) ?? { tableId: row.tableId, reasons: [], minCapacity: 0 };
      if (!entry.reasons.includes(row.reason)) entry.reasons.push(row.reason);
      entry.minCapacity += row.seats;
      result.set(row.tableId, entry);
    }
  }
  for (const entry of result.values()) {
    entry.reasons.sort((a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b));
  }
  return result;
}

type LockableEvent = { id: string; planningStage: PlanningStage };

/**
 * Kilitliyken taahhütlü masalarda yasak değişiklik varsa `conflict` fırlatır (işlem geri alınır,
 * hiçbir şey yazılmaz). Kilitli değilse hiçbir şey yapmaz.
 */
export async function assertLayoutChangeAllowed(
  tx: Tx,
  event: LockableEvent,
  next: readonly LockTableInput[],
): Promise<void> {
  if (!isLayoutLockedStage(event.planningStage)) return;
  const commitments = await loadCommitments(tx, event.id);
  if (commitments.size === 0) return;
  const current = await tx
    .select({
      id: eventTables.id,
      label: eventTables.label,
      capacity: eventTables.capacity,
      x: eventTables.x,
      y: eventTables.y,
      rotation: eventTables.rotation,
      floor: eventTables.floor,
      tableTypeId: eventTables.tableTypeId,
    })
    .from(eventTables)
    .where(eq(eventTables.eventId, event.id));
  const changes = findLockedChanges(current, next, commitments);
  if (changes.length === 0) return;
  const labels = [...new Set(changes.map((c) => c.label))].sort(compareLabels).join(", ");
  throw new DomainError(
    "conflict",
    `Satış başladı; bileti satılmış, rezervasyonu yapılmış ya da Casino'ya ayrılmış masalar değiştirilemez: ${labels}. Hiçbir değişiklik kaydedilmedi.`,
  );
}

export function assertTemplateApplyAllowed(event: { planningStage: PlanningStage }): void {
  if (isLayoutLockedStage(event.planningStage)) {
    throw new DomainError("conflict", "Satış başladıktan sonra şablon uygulanamaz");
  }
}

/** Kilitliyken değiştirilemeyen (taahhütlü) masaların kimlikleri; kilitli değilse `[]`. */
export async function frozenTableIds(ex: Db | Tx, event: LockableEvent): Promise<string[]> {
  if (!isLayoutLockedStage(event.planningStage)) return [];
  return [...(await loadCommitments(ex, event.id)).keys()];
}
