import { asc, count, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, tableTypes } from "@/db/schema";
import { DomainError } from "@/lib/action";
import type { CreateTableTypeInput, UpdateTableTypeInput } from "./schemas";

type Executor = Db | Tx;
export type TableTypeRow = typeof tableTypes.$inferSelect;

const NOT_FOUND = "Masa tipi bulunamadı";

function toValues(input: CreateTableTypeInput) {
  return {
    name: input.name.trim(),
    color: input.color,
    shape: input.shape,
    capacity: input.capacity,
    basePrice: input.basePrice.toFixed(2),
    minSpacing: input.minSpacing,
    isActive: input.isActive,
  };
}

export type TableTypeWithUsage = TableTypeRow & { usageCount: number };

/** Masa tipleri (ada göre); `usageCount` tipi kullanan etkinlik masası sayısıdır. */
export async function listTableTypes(db: Executor, opts: { activeOnly?: boolean } = {}): Promise<TableTypeWithUsage[]> {
  const usage = db
    .select({ tableTypeId: eventTables.tableTypeId, n: count().as("n") })
    .from(eventTables)
    .groupBy(eventTables.tableTypeId)
    .as("usage");
  const rows = await db
    .select({ type: tableTypes, n: usage.n })
    .from(tableTypes)
    .leftJoin(usage, eq(usage.tableTypeId, tableTypes.id))
    .where(opts.activeOnly ? eq(tableTypes.isActive, true) : undefined)
    .orderBy(asc(tableTypes.name), asc(tableTypes.id));
  return rows.map(({ type, n }) => ({ ...type, usageCount: Number(n ?? 0) }));
}

export async function createTableType(db: Executor, input: CreateTableTypeInput): Promise<TableTypeRow> {
  const [row] = await db.insert(tableTypes).values(toValues(input)).returning();
  if (!row) throw new Error("masa tipi eklenemedi");
  return row;
}

export async function updateTableType(db: Executor, input: UpdateTableTypeInput): Promise<TableTypeRow> {
  const [row] = await db
    .update(tableTypes)
    .set({ ...toValues(input), updatedAt: new Date() })
    .where(eq(tableTypes.id, input.id))
    .returning();
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

/** Kullanımdaki tip silinemez (pasife alınabilir); yabancı anahtar ihlali de aynı hataya çevrilir. */
export async function deleteTableType(db: Db, input: { id: string }): Promise<{ id: string }> {
  try {
    return await db.transaction(async (tx) => {
      const [type] = await tx.select().from(tableTypes).where(eq(tableTypes.id, input.id)).for("update");
      if (!type) throw new DomainError("not_found", NOT_FOUND);
      const [used] = await tx.select({ n: count() }).from(eventTables).where(eq(eventTables.tableTypeId, input.id));
      if ((used?.n ?? 0) > 0) throw inUse(used?.n ?? 0);
      await tx.delete(tableTypes).where(eq(tableTypes.id, input.id));
      return { id: input.id };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (hasCode(error, "23503")) throw inUse();
    throw error;
  }
}

function inUse(n?: number): DomainError {
  const count = n === undefined ? "" : ` (${n} masa)`;
  return new DomainError("conflict", `Bu masa tipi kullanımda${count}; silmek yerine pasife alın`);
}

function hasCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
