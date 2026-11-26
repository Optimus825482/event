import { z } from "zod";
import { SALE_CATEGORIES } from "@/domain/seating";
import { MAX_TABLE_CAPACITY, MAX_TABLES } from "@/features/venue/schemas";
import { zonedWallClockToDate } from "@/lib/time-zone";

const HOLD_MESSAGE = "Tutma süresi 5 ile 30 dakika arasında olmalı";
const MAX_SEATS_MESSAGE = "Sipariş başına adet 1 ile 50 arasında olmalı";

/** `Date`, `datetime-local` metni (Kıbrıs duvar saati) ya da boş değer; çıktı `Date | null`. */
const optionalDate = z
  .union([z.date(), z.string(), z.null()])
  .optional()
  .transform((value, ctx): Date | null => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "Geçersiz tarih" });
        return z.NEVER;
      }
      return value;
    }
    const text = value.trim();
    if (text === "") return null;
    const parsed = zonedWallClockToDate(text);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Geçersiz tarih" });
      return z.NEVER;
    }
    return parsed;
  });

export const saleSettingsSchema = z
  .object({
    eventId: z.uuid("Geçersiz etkinlik"),
    sharedTables: z.boolean(),
    blockSingleLeftover: z.boolean(),
    locaOnline: z.boolean(),
    holdMinutes: z.number(HOLD_MESSAGE).int(HOLD_MESSAGE).min(5, HOLD_MESSAGE).max(30, HOLD_MESSAGE),
    maxSeatsPerOrder: z
      .number(MAX_SEATS_MESSAGE)
      .int(MAX_SEATS_MESSAGE)
      .min(1, MAX_SEATS_MESSAGE)
      .max(50, MAX_SEATS_MESSAGE),
    saleStartsAt: optionalDate,
    saleEndsAt: optionalDate,
  })
  .refine((v) => !v.saleStartsAt || !v.saleEndsAt || v.saleEndsAt > v.saleStartsAt, {
    path: ["saleEndsAt"],
    message: "Satış bitişi başlangıçtan sonra olmalı",
  });

export type SaleSettingsInput = z.infer<typeof saleSettingsSchema>;

const classifyItemSchema = z
  .object({
    tableId: z.uuid("Geçersiz masa"),
    category: z.enum(SALE_CATEGORIES, "Geçersiz kategori").optional(),
    /** `null` kapasitenin tamamı demektir; alan verilmezse satılabilir sayı değişmez. */
    sellableSeats: z
      .number("Satılabilir sandalye sayısı geçersiz")
      .int("Satılabilir sandalye sayısı geçersiz")
      .min(1, "Satılabilir sandalye en az 1 olmalı")
      .max(MAX_TABLE_CAPACITY, `Satılabilir sandalye en fazla ${MAX_TABLE_CAPACITY} olabilir`)
      .nullable()
      .optional(),
  })
  .refine((item) => item.category !== undefined || item.sellableSeats !== undefined, {
    message: "Değişiklik belirtilmedi",
  });

export const classifyTablesSchema = z
  .object({
    eventId: z.uuid("Geçersiz etkinlik"),
    items: z.array(classifyItemSchema).min(1, "En az bir masa seçin").max(MAX_TABLES),
  })
  .refine((v) => new Set(v.items.map((i) => i.tableId)).size === v.items.length, {
    path: ["items"],
    message: "Masa iki kez gönderildi",
  });

export type ClassifyTablesInput = z.infer<typeof classifyTablesSchema>;
