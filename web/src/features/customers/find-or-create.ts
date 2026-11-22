import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers } from "@/db/schema";
import { DomainError } from "@/lib/action";
import { normalizeEmail, normalizePhone } from "./normalize";

export type FindOrCreateInput = {
  customerId?: string;
  phone?: string;
  email?: string;
  fullName?: string;
};

export type FoundCustomer = { id: string; isBlacklisted: boolean };

const SELECTED = { id: customers.id, isBlacklisted: customers.isBlacklisted } as const;

type Normalized = { phone: string | null; email: string | null };

async function findByContact(executor: Db | Tx, key: Normalized): Promise<FoundCustomer | null> {
  if (key.phone) {
    const [row] = await executor.select(SELECTED).from(customers).where(eq(customers.phoneNormalized, key.phone));
    if (row) return row;
  }
  if (key.email) {
    const [row] = await executor.select(SELECTED).from(customers).where(eq(customers.emailNormalized, key.email));
    if (row) return row;
  }
  return null;
}

/**
 * Müşteriyi bulur ya da oluşturur. Sıra: `customerId` → telefon → e-posta → (ad varsa) yeni kayıt.
 * Eşzamanlı çağrılar `customers_phone_normalized_uq` / `customers_email_normalized_uq`
 * benzersiz dizinlerine dayanan `ON CONFLICT DO NOTHING` ile tek satırda birleşir.
 * Kara liste yalnızca bildirilir (`isBlacklisted`); engelleme çağıranın işidir.
 */
export async function findOrCreateCustomer(executor: Db | Tx, input: FindOrCreateInput): Promise<FoundCustomer> {
  if (input.customerId) {
    const [row] = await executor.select(SELECTED).from(customers).where(eq(customers.id, input.customerId));
    if (!row) throw new DomainError("not_found", "Müşteri bulunamadı");
    return row;
  }

  const key: Normalized = {
    phone: input.phone ? normalizePhone(input.phone) : null,
    email: input.email ? normalizeEmail(input.email) : null,
  };
  const existing = await findByContact(executor, key);
  if (existing) return existing;

  const fullName = input.fullName?.trim();
  if (!fullName) throw new DomainError("not_found", "Müşteri bulunamadı");

  const [created] = await executor
    .insert(customers)
    .values({
      fullName,
      phone: input.phone?.trim() || null,
      phoneNormalized: key.phone,
      email: input.email?.trim() || null,
      emailNormalized: key.email,
    })
    .onConflictDoNothing()
    .returning(SELECTED);
  if (created) return created;

  // Başka bir bağlantı aynı telefon/e-postayı az önce yazdı; onun satırını oku.
  const winner = await findByContact(executor, key);
  if (!winner) throw new DomainError("conflict", "Müşteri kaydı oluşturulamadı, yeniden deneyin");
  return winner;
}
