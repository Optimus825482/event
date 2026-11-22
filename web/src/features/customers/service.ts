import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, customerTags } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { normalizeEmail, normalizePhone } from "./normalize";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import type { CreateCustomerInput, UpdateCustomerInput } from "./schemas";

type Executor = Db | Tx;

/** 23505 → hangi alanın çakıştığını söyleyen anlamlı DomainError. */
function rethrowUnique(error: unknown): never {
  if (pgCodeOf(error) === "23505") {
    const constraint = pgConstraintOf(error) ?? "";
    if (constraint.includes("phone")) throw new DomainError("conflict", "Bu telefon numarası başka bir müşteriye ait");
    if (constraint.includes("email")) throw new DomainError("conflict", "Bu e-posta adresi başka bir müşteriye ait");
    throw new DomainError("conflict", "Müşteri zaten kayıtlı");
  }
  throw error;
}

export async function createCustomer(db: Db, _actor: Actor, input: CreateCustomerInput): Promise<{ id: string }> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(customers)
        .values({
          fullName: input.fullName,
          phone: input.phone ?? null,
          phoneNormalized: input.phone ? normalizePhone(input.phone) : null,
          email: input.email ?? null,
          emailNormalized: input.email ? normalizeEmail(input.email) : null,
          notes: input.notes ?? null,
        })
        .returning({ id: customers.id });
      if (!row) throw new DomainError("conflict", "Müşteri oluşturulamadı");
      const tags = [...new Set(input.tags)];
      if (tags.length > 0) {
        await tx.insert(customerTags).values(tags.map((tag) => ({ customerId: row.id, tag })));
      }
      return { id: row.id };
    });
  } catch (error) {
    return rethrowUnique(error);
  }
}

export async function updateCustomer(db: Db, _actor: Actor, input: UpdateCustomerInput): Promise<{ id: string }> {
  const changes: Partial<typeof customers.$inferInsert> = {};
  if (input.fullName !== undefined) changes.fullName = input.fullName;
  if (input.vipScore !== undefined) changes.vipScore = input.vipScore;
  if (input.notes !== undefined) changes.notes = input.notes;
  if (input.phone !== undefined) {
    changes.phone = input.phone;
    changes.phoneNormalized = input.phone === null ? null : normalizePhone(input.phone);
  }
  if (input.email !== undefined) {
    changes.email = input.email;
    changes.emailNormalized = input.email === null ? null : normalizeEmail(input.email);
  }

  try {
    const [row] = await db
      .update(customers)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(customers.id, input.id))
      .returning({ id: customers.id });
    if (!row) throw new DomainError("not_found", "Müşteri bulunamadı");
    return row;
  } catch (error) {
    return rethrowUnique(error);
  }
}

export async function setBlacklist(
  db: Executor,
  _actor: Actor,
  input: { id: string; isBlacklisted: boolean },
): Promise<{ id: string; isBlacklisted: boolean }> {
  const [row] = await db
    .update(customers)
    .set({ isBlacklisted: input.isBlacklisted, updatedAt: new Date() })
    .where(eq(customers.id, input.id))
    .returning({ id: customers.id, isBlacklisted: customers.isBlacklisted });
  if (!row) throw new DomainError("not_found", "Müşteri bulunamadı");
  return row;
}

/** Rezervasyonu olan müşteri silinemez (`reservations.customer_id` ON DELETE RESTRICT). */
export async function deleteCustomer(db: Executor, _actor: Actor, input: { id: string }): Promise<{ id: string }> {
  try {
    const [row] = await db.delete(customers).where(eq(customers.id, input.id)).returning({ id: customers.id });
    if (!row) throw new DomainError("not_found", "Müşteri bulunamadı");
    return row;
  } catch (error) {
    if (pgCodeOf(error) === "23503") {
      throw new DomainError("conflict", "Rezervasyonu olan müşteri silinemez");
    }
    throw error;
  }
}
