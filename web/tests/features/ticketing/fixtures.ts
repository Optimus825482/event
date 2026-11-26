import { and, eq, inArray } from "drizzle-orm";
import { expect } from "vitest";
import { db } from "@/db/client";
import { eventTables, events, tickets } from "@/db/schema";
import type { EventStatus } from "@/domain/event-status";
import type { PlanningStage } from "@/domain/planning-stage";
import type { SaleCategory } from "@/domain/seating";
import type { EventRow } from "@/features/events/service";
import type { EventTableRow } from "@/features/reservations/internal";
import type { SalesErrorCode } from "@/features/sales-api/contract";
import type { SaleSettings } from "@/features/seating/settings-service";
import { SalesError } from "@/features/ticketing/orders-service";
import { createEvent, createTable } from "../../helpers/factories";
import { setStage } from "../../helpers/planning";
import { openOnline, setFinalPrices, setSaleSettings } from "../../helpers/seating";

export const PRICES = { standard: "1500.00", premium: "2500.00", vip: "4000.00" } as const;

type TableSpec = {
  label?: string;
  capacity?: number;
  sellableSeats?: number | null;
  category?: SaleCategory;
  isLoca?: boolean;
};

/**
 * Satışta bir etkinlik: varsayılan `published` + `on_sale`, tek masa `A1` 8 kişilik `standard`. Masalar
 * `pending` yaratılıp `openOnline` ile açılır (yuvalar oluşur); `PRICES` kesin fiyat olarak yazılır.
 */
export async function saleEvent(
  o: {
    tables?: TableSpec[];
    settings?: Partial<SaleSettings>;
    prices?: Partial<Record<SaleCategory, string>>;
    stage?: PlanningStage;
    status?: EventStatus;
  } = {},
): Promise<{ event: EventRow; tables: EventTableRow[] }> {
  const created = await createEvent(db, { status: o.status ?? "published" });
  await setStage(db, created.id, o.stage ?? "on_sale");
  const specs = o.tables ?? [{}];
  const ids: string[] = [];
  for (const [i, spec] of specs.entries()) {
    const row = await createTable(db, created.id, {
      label: spec.label ?? (i === 0 ? "A1" : `A${i + 1}`),
      capacity: spec.capacity ?? 8,
      sellableSeats: spec.sellableSeats ?? null,
      saleCategory: spec.category ?? "standard",
      isLoca: spec.isLoca ?? false,
      allocation: "pending",
    });
    ids.push(row.id);
  }
  await db.transaction((tx) => openOnline(tx, created.id, ids));
  if (o.settings) await setSaleSettings(db, created.id, o.settings);
  await setFinalPrices(db, created.id, o.prices ?? PRICES);

  const [event] = await db.select().from(events).where(eq(events.id, created.id));
  if (!event) throw new Error("etkinlik okunamadı");
  const rows = await db.select().from(eventTables).where(inArray(eventTables.id, ids));
  const tables = ids.map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error("masa okunamadı");
    return row;
  });
  return { event, tables };
}

/** Masanın etkin (`held`/`issued`) bilet satırları. */
export async function activeTickets(tableId: string) {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.tableId, tableId), inArray(tickets.status, ["held", "issued"])));
}

/** Çağrıları aynı anda başlatır ve sonuçları başarı/başarısızlık olarak ayırır. */
export async function settle<T>(
  calls: (() => Promise<T>)[],
): Promise<{ ok: PromiseFulfilledResult<T>[]; failed: PromiseRejectedResult[] }> {
  const results: PromiseSettledResult<T>[] = await Promise.allSettled(calls.map((call) => call()));
  return {
    ok: results.filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled"),
    failed: results.filter((r): r is PromiseRejectedResult => r.status === "rejected"),
  };
}

/** Her nedenin `SalesError` olduğunu doğrular ve satış kodlarını döner. */
export function salesCodes(failed: PromiseRejectedResult[]): SalesErrorCode[] {
  return failed.map((f) => {
    expect(f.reason).toBeInstanceOf(SalesError);
    return (f.reason as SalesError).salesCode;
  });
}

/** Sözün `SalesError` ile reddedilmesini bekler ve hatayı döner. */
export async function caughtSales(p: Promise<unknown>): Promise<SalesError> {
  try {
    await p;
  } catch (error) {
    expect(error).toBeInstanceOf(SalesError);
    return error as SalesError;
  }
  throw new Error("SalesError bekleniyordu, istek başarılı oldu");
}
