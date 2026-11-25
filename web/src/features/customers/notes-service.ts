import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, customerTags, events, guestNotes, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { pgCodeOf } from "@/lib/pg-error";
import type { AddNoteInput } from "./schemas";
import { isAdmin } from "@/features/auth/scope";

type Executor = Db | Tx;

async function assertCustomerExists(db: Executor, customerId: string): Promise<void> {
  const [row] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId));
  if (!row) throw new DomainError("not_found", "Müşteri bulunamadı");
}

export async function addTag(
  db: Executor,
  _actor: Actor,
  input: { customerId: string; tag: string },
): Promise<{ customerId: string; tag: string }> {
  const tag = input.tag.trim();
  try {
    await db.insert(customerTags).values({ customerId: input.customerId, tag }).onConflictDoNothing();
  } catch (error) {
    if (pgCodeOf(error) === "23503") throw new DomainError("not_found", "Müşteri bulunamadı");
    throw error;
  }
  return { customerId: input.customerId, tag };
}

export async function removeTag(
  db: Executor,
  _actor: Actor,
  input: { customerId: string; tag: string },
): Promise<{ customerId: string; tag: string }> {
  const tag = input.tag.trim();
  await db.delete(customerTags).where(and(eq(customerTags.customerId, input.customerId), eq(customerTags.tag, tag)));
  return { customerId: input.customerId, tag };
}

/**
 * Not ebeveynleri: etkinlik var olmalı; rezervasyon var olmalı, bu müşteriye ve (verildiyse) bu
 * etkinliğe ait olmalıdır. Kimlikler istemciden gelir, güvenilmez.
 */
async function assertNoteParents(db: Executor, input: AddNoteInput): Promise<void> {
  if (input.eventId) {
    const [event] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, input.eventId));
    if (!event) throw new DomainError("not_found", "Etkinlik bulunamadı");
  }
  if (input.reservationId) {
    const [reservation] = await db
      .select({
        customerId: reservations.customerId,
        eventId: reservations.eventId,
      })
      .from(reservations)
      .where(eq(reservations.id, input.reservationId));
    if (!reservation) {
      throw new DomainError("not_found", "Rezervasyon bulunamadı");
    }
    if (reservation.customerId !== input.customerId) {
      throw new DomainError("invalid", "Rezervasyon bu müşteriye ait değil");
    }
    if (input.eventId && reservation.eventId !== input.eventId) {
      throw new DomainError("invalid", "Rezervasyon seçilen etkinliğe ait değil");
    }
  }
}

export async function addNote(db: Executor, actor: Actor, input: AddNoteInput): Promise<{ id: string }> {
  await assertCustomerExists(db, input.customerId);
  await assertNoteParents(db, input);
  const [row] = await db
    .insert(guestNotes)
    .values({
      customerId: input.customerId,
      content: input.content,
      noteType: input.noteType,
      eventId: input.eventId ?? null,
      reservationId: input.reservationId ?? null,
      createdById: actor.id,
    })
    .returning({ id: guestNotes.id });
  if (!row) throw new DomainError("conflict", "Not eklenemedi");
  return row;
}

/**
 * Notu değiştirme/silme yetkisi: not var olmalı ve yönetici değilse notun yazarı olunmalıdır. Aksi
 * her durumda "yok" gibi görünür.
 */
async function assertNoteAccess(db: Executor, actor: Actor, id: string): Promise<void> {
  const [row] = await db
    .select({ createdById: guestNotes.createdById })
    .from(guestNotes)
    .where(eq(guestNotes.id, id));
  const notFound = new DomainError("not_found", "Not bulunamadı");
  if (!row) throw notFound;
  if (isAdmin(actor)) return;
  if (row.createdById !== actor.id) throw notFound;
}

export async function updateNote(
  db: Executor,
  actor: Actor,
  input: { id: string; content: string },
): Promise<{ id: string }> {
  await assertNoteAccess(db, actor, input.id);
  const [row] = await db
    .update(guestNotes)
    .set({ content: input.content, updatedAt: new Date() })
    .where(eq(guestNotes.id, input.id))
    .returning({ id: guestNotes.id });
  if (!row) throw new DomainError("not_found", "Not bulunamadı");
  return row;
}

export async function deleteNote(db: Executor, actor: Actor, input: { id: string }): Promise<{ id: string }> {
  await assertNoteAccess(db, actor, input.id);
  const [row] = await db.delete(guestNotes).where(eq(guestNotes.id, input.id)).returning({ id: guestNotes.id });
  if (!row) throw new DomainError("not_found", "Not bulunamadı");
  return row;
}
