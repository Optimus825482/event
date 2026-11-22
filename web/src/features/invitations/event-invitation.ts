import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, eventInvitations, eventTables, events, invitationTemplates, reservations } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { ImageRejectedError, deleteImage, saveImage } from "@/features/uploads/images";
import { DomainError } from "@/lib/action";
import { assertInvitationSystemEnabled, getAccessibleEvent } from "./access";
import { smartFixElements, type InvitationElement } from "./elements";
import { resolveEventLayout, type ResolvedLayout } from "./layout";
import type { EventIdInput, RemoveImageInput, SaveEventInvitationInput } from "./schemas";

type Executor = Db | Tx;

export type EventInvitationDetail = {
  event: { id: string; name: string; description: string | null; status: string };
  layout: ResolvedLayout;
};

/** Düzenleyicinin açacağı düzen: özel tasarım → seçili şablon → varsayılan şablon. */
export async function getEventInvitationDetail(db: Executor, actor: Actor, input: EventIdInput): Promise<EventInvitationDetail> {
  authorize(actor, "invitations", "view");
  const event = await getAccessibleEvent(db, actor, input.eventId);
  const layout = await resolveEventLayout(db, event.id);
  return { event: { id: event.id, name: event.name, description: event.description, status: event.status }, layout };
}

/** Etkinlik satırı kilitlenir: `event_invitations.event_id` tekil olmadığından çift satırı bu kilit önler. */
async function lockedInvitation(tx: Tx, actor: Actor, eventId: string) {
  const event = await getAccessibleEvent(tx, actor, eventId);
  await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for("update");
  const [existing] = await tx.select().from(eventInvitations).where(eq(eventInvitations.eventId, event.id)).limit(1);
  return existing ?? null;
}

export async function saveEventInvitation(db: Db, actor: Actor, input: SaveEventInvitationInput): Promise<{ id: string }> {
  authorize(actor, "invitations", "edit");
  await assertInvitationSystemEnabled(db);
  return db.transaction(async (tx) => {
    const existing = await lockedInvitation(tx, actor, input.eventId);
    if (input.templateId) {
      const [template] = await tx
        .select({ id: invitationTemplates.id })
        .from(invitationTemplates)
        .where(and(eq(invitationTemplates.id, input.templateId), eq(invitationTemplates.isActive, true)));
      if (!template) throw new DomainError("not_found", "Şablon bulunamadı");
    }
    const values = {
      templateId: input.templateId,
      customElements: input.customElements
        ? smartFixElements(input.customElements, input.width, input.height)
        : null,
      size: input.size,
      width: input.width,
      height: input.height,
      backgroundColor: input.backgroundColor,
      backgroundImage: input.backgroundImage,
      backgroundGradient: input.backgroundGradient,
      companyLogo: input.companyLogo,
      isActive: true,
      updatedAt: new Date(),
    };
    if (existing) {
      await tx.update(eventInvitations).set(values).where(eq(eventInvitations.id, existing.id));
      return { id: existing.id };
    }
    const [created] = await tx.insert(eventInvitations).values({ eventId: input.eventId, ...values }).returning({ id: eventInvitations.id });
    if (!created) throw new Error("davetiye kaydedilemedi");
    return created;
  });
}

function withoutImage(elements: unknown, path: string): InvitationElement[] | null {
  if (!Array.isArray(elements)) return null;
  return elements.map((element: InvitationElement) => (element.imageUrl === path ? { ...element, imageUrl: undefined } : element));
}

/** Görüntüyü yükler (`invitation/…webp`) ve etkinlik davetiyesinin görüntü listesine ekler. */
export async function addEventImage(db: Db, actor: Actor, input: EventIdInput, file: File): Promise<{ path: string }> {
  authorize(actor, "invitations", "edit");
  await assertInvitationSystemEnabled(db);
  await getAccessibleEvent(db, actor, input.eventId);
  let saved: { path: string };
  try {
    saved = await saveImage(file, "invitation");
  } catch (error) {
    if (error instanceof ImageRejectedError) throw new DomainError("conflict", error.message);
    throw error;
  }
  try {
    await db.transaction(async (tx) => {
      const existing = await lockedInvitation(tx, actor, input.eventId);
      if (existing) {
        const current = Array.isArray(existing.eventImages) ? existing.eventImages : [];
        await tx
          .update(eventInvitations)
          .set({ eventImages: [...current, saved.path], updatedAt: new Date() })
          .where(eq(eventInvitations.id, existing.id));
      } else {
        await tx.insert(eventInvitations).values({ eventId: input.eventId, eventImages: [saved.path] });
      }
    });
  } catch (error) {
    await deleteImage(saved.path).catch(() => undefined);
    throw error;
  }
  return saved;
}

/** Görüntüyü listeden, arka plandan, logodan ve öğelerden çıkarır; dosyayı siler. */
export async function removeEventImage(db: Db, actor: Actor, input: RemoveImageInput): Promise<{ path: string }> {
  authorize(actor, "invitations", "edit");
  await assertInvitationSystemEnabled(db);
  await db.transaction(async (tx) => {
    const existing = await lockedInvitation(tx, actor, input.eventId);
    if (!existing) throw new DomainError("not_found", "Etkinlik davetiyesi bulunamadı");
    const current = Array.isArray(existing.eventImages) ? existing.eventImages : [];
    if (!current.includes(input.path)) throw new DomainError("not_found", "Görüntü bulunamadı");
    await tx
      .update(eventInvitations)
      .set({
        eventImages: current.filter((p) => p !== input.path),
        backgroundImage: existing.backgroundImage === input.path ? null : existing.backgroundImage,
        companyLogo: existing.companyLogo === input.path ? null : existing.companyLogo,
        customElements: withoutImage(existing.customElements, input.path),
        updatedAt: new Date(),
      })
      .where(eq(eventInvitations.id, existing.id));
  });
  await deleteImage(input.path).catch(() => undefined);
  return { path: input.path };
}

export type Recipient = {
  reservationId: string;
  guestName: string;
  tableLabel: string;
  status: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

/** Gönderim paneli listesi: iletişim bilgisinin kendisi değil yalnızca var olup olmadığı döner. */
export async function listRecipients(db: Executor, actor: Actor, input: EventIdInput): Promise<Recipient[]> {
  authorize(actor, "invitations", "view");
  const event = await getAccessibleEvent(db, actor, input.eventId);
  const rows = await db
    .select({
      reservationId: reservations.id,
      guestName: sql<string>`coalesce(nullif(trim(${reservations.guestName}), ''), ${customers.fullName})`,
      tableLabel: eventTables.label,
      status: reservations.status,
      hasEmail: sql<boolean>`coalesce(nullif(trim(${reservations.guestEmail}), ''), nullif(trim(${customers.email}), '')) is not null`,
      hasPhone: sql<boolean>`coalesce(nullif(trim(${reservations.guestPhone}), ''), nullif(trim(${customers.phone}), '')) is not null`,
    })
    .from(reservations)
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .innerJoin(eventTables, eq(eventTables.id, reservations.tableId))
    .where(and(eq(reservations.eventId, event.id), ne(reservations.status, "cancelled"), ne(reservations.status, "no_show")))
    .orderBy(asc(eventTables.label), asc(reservations.id));
  return rows;
}
