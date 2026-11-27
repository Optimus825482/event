import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventSaleSettings, eventTables, events } from "@/db/schema";
import type { SaleMode } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { publish } from "@/features/realtime/publish";
import { DomainError } from "@/lib/action";
import type { SaleSettingsInput } from "./schemas";

export type SaleSettings = {
  eventId: string;
  sharedTables: boolean;
  saleMode: SaleMode;
  blockSingleLeftover: boolean;
  locaOnline: boolean;
  holdMinutes: number;
  maxSeatsPerOrder: number;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  currency: string;
};

/** Satırı olmayan etkinliğin geçerli satış ayarları. */
export const DEFAULT_SALE_SETTINGS: Omit<SaleSettings, "eventId"> = {
  sharedTables: true,
  saleMode: "seat",
  blockSingleLeftover: true,
  locaOnline: false,
  holdMinutes: 10,
  maxSeatsPerOrder: 12,
  saleStartsAt: null,
  saleEndsAt: null,
  currency: "TRY",
};

/** Satış ayarlarını okur; satır yoksa varsayılanlar döner. Yetki denetimi çağırana aittir. */
export async function getSaleSettings(ex: Db | Tx, eventId: string): Promise<SaleSettings> {
  const [row] = await ex.select().from(eventSaleSettings).where(eq(eventSaleSettings.eventId, eventId));
  if (!row) return { eventId, ...DEFAULT_SALE_SETTINGS };
  return {
    eventId,
    sharedTables: row.sharedTables,
    saleMode: row.saleMode,
    blockSingleLeftover: row.blockSingleLeftover,
    locaOnline: row.locaOnline,
    holdMinutes: row.holdMinutes,
    maxSeatsPerOrder: row.maxSeatsPerOrder,
    saleStartsAt: row.saleStartsAt,
    saleEndsAt: row.saleEndsAt,
    currency: row.currency,
  };
}

/** Satış kurallarını kaydeder (Entertainment: `ticketing` düzenleme izni). */
export async function saveSaleSettings(db: Db, actor: Actor, input: SaleSettingsInput): Promise<SaleSettings> {
  authorize(actor, "ticketing", "edit");

  return db.transaction(async (tx) => {
    const [event] = await tx
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, input.eventId))
      .for("update");
    if (!event) throw new DomainError("not_found", "Etkinlik bulunamadı");
    if (event.status === "completed" || event.status === "cancelled") {
      throw new DomainError("conflict", "Tamamlanmış veya iptal edilmiş etkinliğin satış kuralları değiştirilemez");
    }

    if (!input.locaOnline) {
      const online = await tx
        .select({ label: eventTables.label })
        .from(eventTables)
        .where(
          and(eq(eventTables.eventId, input.eventId), eq(eventTables.isLoca, true), eq(eventTables.allocation, "online")),
        );
      if (online.length > 0) {
        const labels = online
          .map((r) => r.label)
          .sort((a, b) => a.localeCompare(b, "tr", { numeric: true }))
          .join(", ");
        throw new DomainError("conflict", `Online satıştaki localar var: ${labels}. Önce bu locaları satıştan çıkarın.`);
      }
    }

    const values = {
      sharedTables: input.sharedTables,
      blockSingleLeftover: input.blockSingleLeftover,
      locaOnline: input.locaOnline,
      holdMinutes: input.holdMinutes,
      maxSeatsPerOrder: input.maxSeatsPerOrder,
      saleStartsAt: input.saleStartsAt,
      saleEndsAt: input.saleEndsAt,
      updatedBy: actor.id,
    };
    await tx
      .insert(eventSaleSettings)
      .values({ eventId: input.eventId, ...values })
      .onConflictDoUpdate({ target: eventSaleSettings.eventId, set: { ...values, updatedAt: new Date() } });

    await publish(tx, { type: "sales.changed", eventId: input.eventId });
    return getSaleSettings(tx, input.eventId);
  });
}
