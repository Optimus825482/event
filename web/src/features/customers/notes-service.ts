import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, customerTags, guestNotes } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { pgCodeOf } from "./pg-error";
import type { AddNoteInput } from "./schemas";

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

export async function addNote(db: Executor, actor: Actor, input: AddNoteInput): Promise<{ id: string }> {
  await assertCustomerExists(db, input.customerId);
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

export async function updateNote(
  db: Executor,
  _actor: Actor,
  input: { id: string; content: string },
): Promise<{ id: string }> {
  const [row] = await db
    .update(guestNotes)
    .set({ content: input.content, updatedAt: new Date() })
    .where(eq(guestNotes.id, input.id))
    .returning({ id: guestNotes.id });
  if (!row) throw new DomainError("not_found", "Not bulunamadı");
  return row;
}

export async function deleteNote(db: Executor, _actor: Actor, input: { id: string }): Promise<{ id: string }> {
  const [row] = await db.delete(guestNotes).where(eq(guestNotes.id, input.id)).returning({ id: guestNotes.id });
  if (!row) throw new DomainError("not_found", "Not bulunamadı");
  return row;
}
