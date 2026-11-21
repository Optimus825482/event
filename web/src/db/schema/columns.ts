import { char, numeric, timestamp, uuid } from "drizzle-orm/pg-core";

// Alan şeması tablolarının ortak sütun yapı taşları. Tablo değil; index.ts dışa aktarmaz.

/** `uuid` birincil anahtar, `gen_random_uuid()` varsayılanı. */
export const pk = () => uuid("id").primaryKey().defaultRandom();

/** Zaman damgası: her zaman `timestamp with time zone`. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => tstz("created_at").notNull().defaultNow();

/** Değişmeyen satırlar (bağlantı/log tabloları) için yalnızca `created_at`. */
export const createdOnly = () => ({ createdAt: createdAt() });

/** Değişebilen satırlar için `created_at` + `updated_at`. */
export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: tstz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Para tutarı: `numeric(12,2)`, varsayılan 0. Değer string olarak döner (kesinlik kaybı olmaz). */
export const money = (name: string) => numeric(name, { precision: 12, scale: 2 }).notNull().default("0");

/** ISO 4217 para birimi kodu. */
export const currency = () => char("currency", { length: 3 }).notNull().default("TRY");
